import {
  createDatabasePool,
  GameAnalyticsRepository,
  GameRepository,
  runMigrations,
} from '@nba-event-platform/database';
import {
  connectRedisEventBus,
  type RedisEventBus,
} from '@nba-event-platform/event-bus';
import type { GameEvent } from '@nba-event-platform/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalyticsWorker } from '../../src/index.js';
import { createEvent, game } from '../fixtures.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
const describeWithServices = databaseUrl && redisUrl ? describe : describe.skip;

describeWithServices('analytics worker integration', () => {
  if (!databaseUrl || !redisUrl) {
    return;
  }

  const testId = Date.now();
  const consumerGroup = `analytics-test-${testId}`;
  const integrationGame = {
    ...game,
    gameId: `analytics-integration-${testId}`,
    status: 'live' as const,
  };
  const eventDetails = [
    { eventType: 'shot_made', teamId: 'BOS', points: 3 },
    { eventType: 'shot_missed', teamId: 'BOS', points: 3 },
    { eventType: 'free_throw_made', teamId: 'BOS', points: 1 },
    { eventType: 'free_throw_missed', teamId: 'BOS', points: undefined },
    { eventType: 'turnover', teamId: 'BOS', points: undefined },
    { eventType: 'shot_made', teamId: 'NYK', points: 2 },
  ] as const;
  const events: GameEvent[] = eventDetails.map((details, index) =>
    createEvent({
      eventId: `analytics-event-${testId}-${index + 1}`,
      gameId: integrationGame.gameId,
      sequence: index + 1,
      ...details,
    }),
  );
  const database = createDatabasePool({
    applicationName: 'analytics-integration-test',
    connectionString: databaseUrl,
  });
  const analytics = new GameAnalyticsRepository(database);
  const redisErrors: Error[] = [];
  let eventBus: RedisEventBus | undefined;

  beforeAll(async () => {
    await runMigrations(database);
    await database.query('DELETE FROM games WHERE id = $1', [
      integrationGame.gameId,
    ]);
    await new GameRepository(database).save(integrationGame);
    eventBus = await connectRedisEventBus({
      url: redisUrl,
      streamKey: `analytics-events:${testId}`,
      onError: (error) => redisErrors.push(error),
    });
  });

  afterAll(async () => {
    await eventBus?.close();
    await database.query('DELETE FROM games WHERE id = $1', [
      integrationGame.gameId,
    ]);
    await database.end();
  });

  it('derives and persists analytics from streamed events', async () => {
    if (!eventBus) {
      throw new Error('event bus was not initialized');
    }

    for (const event of events) {
      await eventBus.publish(event);
    }

    const worker = new AnalyticsWorker(
      {
        analytics,
        eventBus,
        games: new GameRepository(database),
      },
      {
        batchSize: events.length,
        blockMs: 1_000,
        consumerGroup,
        consumerName: 'integration-worker',
      },
    );

    await expect(worker.processNextBatch()).resolves.toBe(events.length);
    await expect(
      analytics.findByGameId(integrationGame.gameId),
    ).resolves.toEqual({
      gameId: integrationGame.gameId,
      homeTeam: {
        teamId: 'BOS',
        points: 4,
        turnovers: 1,
        fieldGoalsMade: 1,
        fieldGoalsAttempted: 2,
        fieldGoalPercentage: 0.5,
        threePointersMade: 1,
        threePointersAttempted: 2,
        threePointPercentage: 0.5,
        freeThrowsMade: 1,
        freeThrowsAttempted: 2,
        freeThrowPercentage: 0.5,
      },
      awayTeam: {
        teamId: 'NYK',
        points: 2,
        turnovers: 0,
        fieldGoalsMade: 1,
        fieldGoalsAttempted: 1,
        fieldGoalPercentage: 1,
        threePointersMade: 0,
        threePointersAttempted: 0,
        threePointPercentage: 0,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        freeThrowPercentage: 0,
      },
      lastProcessedSequence: events.length,
    });
    await expect(
      eventBus.claimPending({
        consumerGroup,
        consumerName: 'recovery-worker',
        minIdleTimeMs: 0,
      }),
    ).resolves.toEqual([]);
    expect(redisErrors).toEqual([]);
  });
});
