import type {
  GameAnalyticsRepository,
  GameRepository,
} from '@nba-event-platform/database';
import type { EventBus } from '@nba-event-platform/event-bus';
import type { GameAnalytics } from '@nba-event-platform/schemas';
import { describe, expect, it, vi } from 'vitest';

import {
  AnalyticsWorker,
  applyAnalyticsEvent,
  createInitialGameAnalytics,
  type AnalyticsWorkerDependencies,
} from '../src/index.js';
import { createEvent, game } from './fixtures.js';

function createDependencies(): AnalyticsWorkerDependencies {
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
  const analytics = {
    findByGameId: vi.fn(async () => createInitialGameAnalytics(game)),
    save: vi.fn(async (value: GameAnalytics) => value),
  } satisfies Pick<GameAnalyticsRepository, 'findByGameId' | 'save'>;
  const games = {
    findById: vi.fn(async () => game),
  } satisfies Pick<GameRepository, 'findById'>;

  return { analytics, eventBus, games };
}

describe('AnalyticsWorker', () => {
  it('creates its consumer group and returns when no events are available', async () => {
    const dependencies = createDependencies();
    const worker = new AnalyticsWorker(dependencies, {
      consumerName: 'worker-1',
      blockMs: 100,
    });

    await expect(worker.processNextBatch()).resolves.toBe(0);
    expect(dependencies.eventBus.ensureConsumerGroup).toHaveBeenCalledWith(
      'analytics',
    );
    expect(dependencies.eventBus.claimPending).toHaveBeenCalledWith({
      consumerGroup: 'analytics',
      consumerName: 'worker-1',
      minIdleTimeMs: 30_000,
      count: 10,
    });
    expect(dependencies.eventBus.read).toHaveBeenCalledWith({
      consumerGroup: 'analytics',
      consumerName: 'worker-1',
      count: 10,
      blockMs: 100,
    });
  });

  it('processes an abandoned message before reading new messages', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.eventBus.claimPending).mockResolvedValueOnce([
      { messageId: 'pending-message', event: createEvent() },
    ]);
    const worker = new AnalyticsWorker(dependencies, {
      consumerName: 'recovery-worker',
      claimIdleMs: 1_000,
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.eventBus.read).not.toHaveBeenCalled();
    expect(dependencies.analytics.save).toHaveBeenCalledOnce();
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'analytics',
      'pending-message',
    );
  });

  it('updates existing analytics and acknowledges after saving', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    const worker = new AnalyticsWorker(dependencies, {
      consumerName: 'worker-1',
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.analytics.save).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: game.gameId,
        homeTeam: expect.objectContaining({ points: 3 }),
        lastProcessedSequence: 1,
      }),
    );
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'analytics',
      'message-1',
    );
  });

  it('initializes analytics when processing the first game event', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.analytics.findByGameId).mockResolvedValueOnce(null);
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    const worker = new AnalyticsWorker(dependencies, {
      consumerName: 'worker-1',
    });

    await worker.processNextBatch();

    expect(dependencies.games.findById).toHaveBeenCalledWith(game.gameId);
    expect(dependencies.analytics.save).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: game.gameId,
        homeTeam: expect.objectContaining({ points: 3 }),
        lastProcessedSequence: 1,
      }),
    );
  });

  it('dead-letters a message when persistence exhausts its attempts', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    vi.mocked(dependencies.analytics.save).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    const worker = new AnalyticsWorker(dependencies, {
      consumerName: 'worker-1',
      maxAttempts: 1,
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.eventBus.deadLetter).toHaveBeenCalledWith({
      consumerGroup: 'analytics',
      message: { messageId: 'message-1', event: createEvent() },
      reason: 'database unavailable',
      attempts: 1,
    });
    expect(dependencies.eventBus.acknowledge).toHaveBeenCalledWith(
      'analytics',
      'message-1',
    );
  });

  it('leaves the original message pending when dead-lettering fails', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    vi.mocked(dependencies.analytics.save).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    vi.mocked(dependencies.eventBus.deadLetter).mockRejectedValueOnce(
      new Error('redis unavailable'),
    );
    const worker = new AnalyticsWorker(dependencies, {
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
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    vi.mocked(dependencies.analytics.save).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    const worker = new AnalyticsWorker(dependencies, {
      consumerName: 'worker-1',
      maxAttempts: 3,
      retryDelayMs: 0,
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.analytics.save).toHaveBeenCalledTimes(2);
    expect(dependencies.eventBus.deadLetter).not.toHaveBeenCalled();
  });

  it('does not apply an event twice after acknowledgement failure and restart', async () => {
    const event = createEvent();
    let storedAnalytics = createInitialGameAnalytics(game);
    const firstDependencies = createDependencies();
    vi.mocked(firstDependencies.analytics.findByGameId).mockImplementation(
      async () => storedAnalytics,
    );
    vi.mocked(firstDependencies.analytics.save).mockImplementation(
      async (analytics) => {
        storedAnalytics = analytics;
        return analytics;
      },
    );
    vi.mocked(firstDependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event },
    ]);
    vi.mocked(firstDependencies.eventBus.acknowledge).mockResolvedValueOnce(
      false,
    );
    const firstWorker = new AnalyticsWorker(firstDependencies, {
      consumerName: 'worker-1',
      maxAttempts: 1,
    });

    await expect(firstWorker.processNextBatch()).rejects.toThrow(
      'was not acknowledged',
    );
    expect(storedAnalytics.homeTeam.points).toBe(3);
    expect(firstDependencies.eventBus.deadLetter).not.toHaveBeenCalled();

    const restartedDependencies = createDependencies();
    vi.mocked(
      restartedDependencies.analytics.findByGameId,
    ).mockResolvedValueOnce(storedAnalytics);
    vi.mocked(restartedDependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event },
    ]);
    const restartedWorker = new AnalyticsWorker(restartedDependencies, {
      consumerName: 'worker-2',
    });

    await expect(restartedWorker.processNextBatch()).resolves.toBe(1);
    expect(restartedDependencies.analytics.save).not.toHaveBeenCalled();
    expect(storedAnalytics.homeTeam.points).toBe(3);
  });

  it('dead-letters an out-of-order event without persisting it', async () => {
    const dependencies = createDependencies();
    const current = applyAnalyticsEvent(
      createInitialGameAnalytics(game),
      createEvent({ eventId: 'evt-2', sequence: 2 }),
    );
    vi.mocked(dependencies.analytics.findByGameId).mockResolvedValueOnce(
      current,
    );
    vi.mocked(dependencies.eventBus.read).mockResolvedValueOnce([
      { messageId: 'message-1', event: createEvent() },
    ]);
    const worker = new AnalyticsWorker(dependencies, {
      consumerName: 'worker-1',
      maxAttempts: 1,
    });

    await expect(worker.processNextBatch()).resolves.toBe(1);
    expect(dependencies.analytics.save).not.toHaveBeenCalled();
    expect(dependencies.eventBus.deadLetter).toHaveBeenCalledWith({
      consumerGroup: 'analytics',
      message: { messageId: 'message-1', event: createEvent() },
      reason: 'event evt-1 sequence 1 is not after 2',
      attempts: 1,
    });
  });
});
