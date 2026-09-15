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
    ensureConsumerGroup: vi.fn(async () => undefined),
    read: vi.fn(async () => []),
  } satisfies Pick<EventBus, 'acknowledge' | 'ensureConsumerGroup' | 'read'>;
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
    expect(dependencies.eventBus.read).toHaveBeenCalledWith({
      consumerGroup: 'box-score',
      consumerName: 'worker-1',
      count: 10,
      blockMs: 100,
    });
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

  it('leaves a message pending when stats persistence fails', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    vi.mocked(dependencies.stats.save).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    const worker = new BoxScoreWorker(dependencies, {
      consumerName: 'worker-1',
    });

    await expect(worker.processNextBatch()).rejects.toThrow(
      'database unavailable',
    );
    expect(dependencies.eventBus.acknowledge).not.toHaveBeenCalled();
  });
});
