import type { PlayerGameStatsRepository } from '@nba-event-platform/database';
import type { EventBus } from '@nba-event-platform/event-bus';
import type { PlayerGameStats } from '@nba-event-platform/schemas';
import { describe, expect, it, vi } from 'vitest';

import {
  BoxScoreWorker,
  createInitialPlayerGameStats,
  type BoxScoreWorkerDependencies,
} from '../src/index.js';
import { createEvent } from './fixtures.js';

function createDependencies(): BoxScoreWorkerDependencies {
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
  const stats = {
    find: vi.fn(async () =>
      createInitialPlayerGameStats('bos-nyk-2026-01', 'player-0'),
    ),
    save: vi.fn(async (value: PlayerGameStats) => value),
  } satisfies Pick<PlayerGameStatsRepository, 'find' | 'save'>;

  return { eventBus, stats };
}

describe('BoxScoreWorker', () => {
  it('creates its consumer group and returns when no events are available', async () => {
    const dependencies = createDependencies();
    const worker = new BoxScoreWorker(dependencies, {
      consumerName: 'worker-1',
      blockMs: 100,
    });

    await expect(worker.processNextBatch()).resolves.toBe(0);
    expect(dependencies.eventBus.ensureConsumerGroup).toHaveBeenCalledWith(
      'box-score',
    );
    expect(dependencies.eventBus.claimPending).toHaveBeenCalledWith({
      consumerGroup: 'box-score',
      consumerName: 'worker-1',
      minIdleTimeMs: 30_000,
      count: 10,
    });
    expect(dependencies.eventBus.read).toHaveBeenCalledWith({
      consumerGroup: 'box-score',
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
    const worker = new BoxScoreWorker(dependencies, {
      consumerName: 'recovery-worker',
      claimIdleMs: 1_000,
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.eventBus.claimPending).toHaveBeenCalledWith({
      consumerGroup: 'box-score',
      consumerName: 'recovery-worker',
      minIdleTimeMs: 1_000,
      count: 10,
    });
    expect(dependencies.eventBus.read).not.toHaveBeenCalled();
    expect(dependencies.stats.save).toHaveBeenCalledOnce();
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'box-score',
      'pending-message',
    );
  });

  it('updates existing stats and acknowledges after saving', async () => {
    const dependencies = createDependencies();
    const event = createEvent({ eventType: 'shot_made', points: 3 });
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event },
    ]);
    const worker = new BoxScoreWorker(dependencies, {
      consumerName: 'worker-1',
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.stats.save).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: event.gameId,
        playerId: event.playerId,
        points: 3,
        threePointersMade: 1,
      }),
    );
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'box-score',
      'message-1',
    );
  });

  it('initializes stats for a player without a saved stat line', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.stats.find).mockResolvedValueOnce(null);
    const event = createEvent({ eventType: 'rebound' });
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event },
    ]);
    const worker = new BoxScoreWorker(dependencies, {
      consumerName: 'worker-1',
    });

    await worker.processNextBatch();

    expect(dependencies.stats.save).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: event.gameId,
        playerId: event.playerId,
        rebounds: 1,
      }),
    );
  });

  it('acknowledges events that do not belong to a player', async () => {
    const dependencies = createDependencies();
    const event = createEvent({
      eventType: 'period_start',
      playerId: undefined,
    });
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event },
    ]);
    const worker = new BoxScoreWorker(dependencies, {
      consumerName: 'worker-1',
    });

    await worker.processNextBatch();

    expect(dependencies.stats.find).not.toHaveBeenCalled();
    expect(dependencies.stats.save).not.toHaveBeenCalled();
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'box-score',
      'message-1',
    );
  });

  it('dead-letters a message when stats persistence exhausts its attempts', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    vi.mocked(dependencies.stats.save).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    const worker = new BoxScoreWorker(dependencies, {
      consumerName: 'worker-1',
      maxAttempts: 1,
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.eventBus.deadLetter).toHaveBeenCalledWith({
      consumerGroup: 'box-score',
      message: { messageId: 'message-1', event: createEvent() },
      reason: 'database unavailable',
      attempts: 1,
    });
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'box-score',
      'message-1',
    );
  });

  it('leaves the original message pending when dead-lettering fails', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    vi.mocked(dependencies.stats.save).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    vi.mocked(dependencies.eventBus.deadLetter).mockRejectedValueOnce(
      new Error('redis unavailable'),
    );
    const worker = new BoxScoreWorker(dependencies, {
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
    vi.mocked(dependencies.stats.save).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    const worker = new BoxScoreWorker(dependencies, {
      consumerName: 'worker-1',
      maxAttempts: 3,
      retryDelayMs: 0,
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.stats.save).toHaveBeenCalledTimes(2);
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledOnce();
    expect(dependencies.eventBus.read).toHaveBeenCalledOnce();
    expect(dependencies.eventBus.deadLetter).not.toHaveBeenCalled();
  });

  it('does not apply an event twice after acknowledgement failure and restart', async () => {
    const event = createEvent({ eventType: 'shot_made', points: 3 });
    let storedStats = createInitialPlayerGameStats(
      event.gameId,
      event.playerId!,
    );
    const firstDependencies = createDependencies();
    vi.mocked(firstDependencies.stats.find).mockImplementation(
      async () => storedStats,
    );
    vi.mocked(firstDependencies.stats.save).mockImplementation(
      async (stats) => {
        storedStats = stats;
        return stats;
      },
    );
    vi.mocked(firstDependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event },
    ]);
    vi.mocked(firstDependencies.eventBus.acknowledge).mockResolvedValueOnce(
      false,
    );
    const firstWorker = new BoxScoreWorker(firstDependencies, {
      consumerName: 'worker-1',
      maxAttempts: 1,
    });

    await expect(firstWorker.processNextBatch()).rejects.toThrow(
      'was not acknowledged',
    );
    expect(storedStats.points).toBe(3);
    expect(firstDependencies.eventBus.deadLetter).not.toHaveBeenCalled();

    const restartedDependencies = createDependencies();
    vi.mocked(restartedDependencies.stats.find).mockResolvedValueOnce(
      storedStats,
    );
    vi.mocked(restartedDependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event },
    ]);
    const restartedWorker = new BoxScoreWorker(restartedDependencies, {
      consumerName: 'worker-2',
    });

    await expect(restartedWorker.processNextBatch()).resolves.toBe(1);
    expect(restartedDependencies.stats.save).not.toHaveBeenCalled();
    expect(restartedDependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'box-score',
      'message-1',
    );
    expect(storedStats.points).toBe(3);
  });

  it('dead-letters an out-of-order player event without persisting it', async () => {
    const dependencies = createDependencies();
    const current = {
      ...createInitialPlayerGameStats('bos-nyk-2026-01', 'player-0'),
      lastProcessedSequence: 2,
    };
    vi.mocked(dependencies.stats.find).mockResolvedValueOnce(current);
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    const worker = new BoxScoreWorker(dependencies, {
      consumerName: 'worker-1',
      maxAttempts: 1,
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.stats.save).not.toHaveBeenCalled();
    expect(dependencies.eventBus.deadLetter).toHaveBeenCalledWith({
      consumerGroup: 'box-score',
      message: { messageId: 'message-1', event: createEvent() },
      reason: 'event evt-1 sequence 1 is not after 2',
      attempts: 1,
    });
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'box-score',
      'message-1',
    );
  });
});
