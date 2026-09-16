import type {
  GameRepository,
  GameStateRepository,
} from '@nba-event-platform/database';
import type { EventBus } from '@nba-event-platform/event-bus';
import type { GameState } from '@nba-event-platform/schemas';
import { describe, expect, it, vi } from 'vitest';

import {
  applyGameEvent,
  createInitialGameState,
  GameStateWorker,
  type GameStateWorkerDependencies,
} from '../src/index.js';
import { createEvent, game } from './fixtures.js';

function createDependencies(): GameStateWorkerDependencies {
  const eventBus = {
    acknowledge: vi.fn(async () => true),
    claimPending: vi.fn(async () => []),
    deadLetter: vi.fn(async () => 'dead-letter-message'),
    ensureConsumerGroup: vi.fn(async () => undefined),
    read: vi.fn(async () => []),
  } satisfies Pick<
    EventBus,
    | 'acknowledge'
    | 'claimPending'
    | 'deadLetter'
    | 'ensureConsumerGroup'
    | 'read'
  >;
  const games = {
    findById: vi.fn(async () => game),
  } satisfies Pick<GameRepository, 'findById'>;
  const states = {
    findByGameId: vi.fn(async () => createInitialGameState(game)),
    save: vi.fn(async (state: GameState) => state),
  } satisfies Pick<GameStateRepository, 'findByGameId' | 'save'>;

  return { eventBus, games, states };
}

describe('GameStateWorker', () => {
  it('creates its consumer group and returns when no events are available', async () => {
    const dependencies = createDependencies();
    const worker = new GameStateWorker(dependencies, {
      consumerName: 'worker-1',
      blockMs: 100,
    });

    await expect(worker.processNextBatch()).resolves.toBe(0);
    expect(dependencies.eventBus.ensureConsumerGroup).toHaveBeenCalledWith(
      'game-state',
    );
    expect(dependencies.eventBus.claimPending).toHaveBeenCalledWith({
      consumerGroup: 'game-state',
      consumerName: 'worker-1',
      minIdleTimeMs: 30_000,
      count: 10,
    });
    expect(dependencies.eventBus.read).toHaveBeenCalledWith({
      consumerGroup: 'game-state',
      consumerName: 'worker-1',
      count: 10,
      blockMs: 100,
    });
  });

  it('processes an abandoned message before reading new messages', async () => {
    const dependencies = createDependencies();
    const event = createEvent();
    vi.mocked(dependencies.eventBus.claimPending).mockResolvedValueOnce([
      { messageId: 'pending-message', event },
    ]);
    const worker = new GameStateWorker(dependencies, {
      consumerName: 'recovery-worker',
      claimIdleMs: 1_000,
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.eventBus.claimPending).toHaveBeenCalledWith({
      consumerGroup: 'game-state',
      consumerName: 'recovery-worker',
      minIdleTimeMs: 1_000,
      count: 10,
    });
    expect(dependencies.eventBus.read).not.toHaveBeenCalled();
    expect(dependencies.states.save).toHaveBeenCalledOnce();
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'game-state',
      'pending-message',
    );
  });

  it('updates existing state and acknowledges after saving', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.states.findByGameId).mockResolvedValueOnce(
      applyGameEvent(createInitialGameState(game), createEvent()),
    );
    const event = createEvent({
      eventId: 'evt-2',
      sequence: 2,
      eventType: 'shot_made',
      teamId: game.homeTeamId,
      points: 3,
    });
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event },
    ]);
    const worker = new GameStateWorker(dependencies, {
      consumerName: 'worker-1',
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.states.save).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: game.gameId,
        homeScore: 3,
        lastProcessedSequence: 2,
      }),
    );
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'game-state',
      'message-1',
    );
  });

  it('initializes state when processing the first game event', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.states.findByGameId).mockResolvedValueOnce(null);
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    const worker = new GameStateWorker(dependencies, {
      consumerName: 'worker-1',
    });

    await worker.processNextBatch();

    expect(dependencies.games.findById).toHaveBeenCalledWith(game.gameId);
    expect(dependencies.states.save).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: game.gameId,
        status: 'live',
        lastProcessedSequence: 1,
      }),
    );
  });

  it('dead-letters a message when state persistence exhausts its attempts', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    vi.mocked(dependencies.states.save).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    const worker = new GameStateWorker(dependencies, {
      consumerName: 'worker-1',
      maxAttempts: 1,
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.eventBus.deadLetter).toHaveBeenCalledWith({
      consumerGroup: 'game-state',
      message: { messageId: 'message-1', event: createEvent() },
      reason: 'database unavailable',
      attempts: 1,
    });
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'game-state',
      'message-1',
    );
  });

  it('leaves the original message pending when dead-lettering fails', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    vi.mocked(dependencies.states.save).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    vi.mocked(dependencies.eventBus.deadLetter).mockRejectedValueOnce(
      new Error('redis unavailable'),
    );
    const worker = new GameStateWorker(dependencies, {
      consumerName: 'worker-1',
      maxAttempts: 1,
    });

    await expect(worker.processNextBatch()).rejects.toThrow(
      'redis unavailable',
    );
    expect(dependencies.eventBus.acknowledge).not.toHaveBeenCalled();
  });

  it('retries a transient persistence failure with the same message', async () => {
    const dependencies = createDependencies();
    const event = createEvent();
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event },
    ]);
    vi.mocked(dependencies.states.save).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    const worker = new GameStateWorker(dependencies, {
      consumerName: 'worker-1',
      maxAttempts: 3,
      retryDelayMs: 0,
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.states.save).toHaveBeenCalledTimes(2);
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledOnce();
    expect(dependencies.eventBus.read).toHaveBeenCalledOnce();
    expect(dependencies.eventBus.deadLetter).not.toHaveBeenCalled();
  });

  it('does not apply an event twice after acknowledgement failure and restart', async () => {
    const event = createEvent({
      eventType: 'shot_made',
      teamId: game.homeTeamId,
      points: 3,
    });
    let storedState = createInitialGameState(game);
    const firstDependencies = createDependencies();
    vi.mocked(firstDependencies.states.findByGameId).mockImplementation(
      async () => storedState,
    );
    vi.mocked(firstDependencies.states.save).mockImplementation(
      async (state) => {
        storedState = state;
        return state;
      },
    );
    vi.mocked(firstDependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event },
    ]);
    vi.mocked(firstDependencies.eventBus.acknowledge).mockResolvedValueOnce(
      false,
    );
    const firstWorker = new GameStateWorker(firstDependencies, {
      consumerName: 'worker-1',
      maxAttempts: 1,
    });

    await expect(firstWorker.processNextBatch()).rejects.toThrow(
      'was not acknowledged',
    );
    expect(storedState.homeScore).toBe(3);
    expect(firstDependencies.eventBus.deadLetter).not.toHaveBeenCalled();

    const restartedDependencies = createDependencies();
    vi.mocked(restartedDependencies.states.findByGameId).mockResolvedValueOnce(
      storedState,
    );
    vi.mocked(restartedDependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event },
    ]);
    const restartedWorker = new GameStateWorker(restartedDependencies, {
      consumerName: 'worker-2',
    });

    await expect(restartedWorker.processNextBatch()).resolves.toBe(1);
    expect(restartedDependencies.states.save).not.toHaveBeenCalled();
    expect(restartedDependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'game-state',
      'message-1',
    );
    expect(storedState.homeScore).toBe(3);
  });

  it('acknowledges a stale event without persisting it again', async () => {
    const dependencies = createDependencies();
    const current = applyGameEvent(
      applyGameEvent(createInitialGameState(game), createEvent()),
      createEvent({ eventId: 'evt-2', sequence: 2 }),
    );
    vi.mocked(dependencies.states.findByGameId).mockResolvedValueOnce(current);
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    const worker = new GameStateWorker(dependencies, {
      consumerName: 'worker-1',
      maxAttempts: 1,
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.states.save).not.toHaveBeenCalled();
    expect(dependencies.eventBus.deadLetter).not.toHaveBeenCalled();
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'game-state',
      'message-1',
    );
  });

  it('leaves an event pending when an earlier sequence is missing', async () => {
    const dependencies = createDependencies();
    const event = createEvent({ eventId: 'evt-3', sequence: 3 });
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-3', event },
    ]);
    const worker = new GameStateWorker(dependencies, {
      consumerName: 'worker-1',
      maxAttempts: 1,
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.states.save).not.toHaveBeenCalled();
    expect(dependencies.eventBus.deadLetter).not.toHaveBeenCalled();
    expect(dependencies.eventBus.acknowledge).not.toHaveBeenCalled();
  });
});
