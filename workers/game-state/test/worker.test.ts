import type {
  GameRepository,
  GameStateRepository,
} from '@nba-event-platform/database';
import type { EventBus } from '@nba-event-platform/event-bus';
import type { GameState } from '@nba-event-platform/schemas';
import { describe, expect, it, vi } from 'vitest';

import {
  createInitialGameState,
  GameStateWorker,
  type GameStateWorkerDependencies,
} from '../src/index.js';
import { createEvent, game } from './fixtures.js';

function createDependencies(): GameStateWorkerDependencies {
  const eventBus = {
    acknowledge: vi.fn(async () => true),
    ensureConsumerGroup: vi.fn(async () => undefined),
    read: vi.fn(async () => []),
  } satisfies Pick<EventBus, 'acknowledge' | 'ensureConsumerGroup' | 'read'>;
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
    expect(dependencies.eventBus.read).toHaveBeenCalledWith({
      consumerGroup: 'game-state',
      consumerName: 'worker-1',
      count: 10,
      blockMs: 100,
    });
  });

  it('updates existing state and acknowledges after saving', async () => {
    const dependencies = createDependencies();
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

  it('leaves a message pending when state persistence fails', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    vi.mocked(dependencies.states.save).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    const worker = new GameStateWorker(dependencies, {
      consumerName: 'worker-1',
    });

    await expect(worker.processNextBatch()).rejects.toThrow(
      'database unavailable',
    );
    expect(dependencies.eventBus.acknowledge).not.toHaveBeenCalled();
  });
});
