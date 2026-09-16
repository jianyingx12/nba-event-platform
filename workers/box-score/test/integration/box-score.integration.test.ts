import {
  createDatabasePool,
  GameEventRepository,
  GameRepository,
  PlayerGameStatsRepository,
  runMigrations,
} from '@nba-event-platform/database';
import {
  connectRedisEventBus,
  type RedisEventBus,
} from '@nba-event-platform/event-bus';
import type { GameEvent } from '@nba-event-platform/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BoxScoreWorker } from '../../src/index.js';
import { createEvent } from '../fixtures.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
const describeWithServices = databaseUrl && redisUrl ? describe : describe.skip;

describeWithServices('box score worker integration', () => {
  if (!databaseUrl || !redisUrl) {
    return;
  }

  const testId = Date.now();
  const consumerGroup = `box-score-test-${testId}`;
  const game = {
    gameId: `box-score-integration-${testId}`,
    homeTeamId: 'BOS',
    awayTeamId: 'NYK',
    scheduledAt: '2026-01-15T00:00:00.000Z',
    startedAt: '2026-01-15T00:05:00.000Z',
    status: 'live' as const,
  };
  const eventTypes = [
    ['shot_made', 3],
    ['shot_missed', 3],
    ['shot_made', 2],
    ['free_throw_made', 1],
    ['free_throw_missed', undefined],
    ['rebound', undefined],
    ['assist', undefined],
    ['steal', undefined],
    ['block', undefined],
    ['turnover', undefined],
  ] as const;
  const events: GameEvent[] = eventTypes.map(([eventType, points], index) =>
    createEvent({
      eventId: `box-score-event-${testId}-${index + 1}`,
      gameId: game.gameId,
      sequence: index + 1,
      eventType,
      points,
    }),
  );
  const database = createDatabasePool({
    applicationName: 'box-score-integration-test',
    connectionString: databaseUrl,
  });
  const stats = new PlayerGameStatsRepository(database);
  const eventRepository = new GameEventRepository(database);
  const redisErrors: Error[] = [];
  let eventBus: RedisEventBus | undefined;

  beforeAll(async () => {
    await runMigrations(database);
    await database.query('DELETE FROM games WHERE id = $1', [game.gameId]);
    await new GameRepository(database).save(game);
    eventBus = await connectRedisEventBus({
      url: redisUrl,
      streamKey: `box-score-events:${testId}`,
      onError: (error) => redisErrors.push(error),
    });
  });

  afterAll(async () => {
    await eventBus?.close();
    await database.query('DELETE FROM games WHERE id = $1', [game.gameId]);
    await database.end();
  });

  it('builds and persists a known box score from streamed events', async () => {
    if (!eventBus) {
      throw new Error('event bus was not initialized');
    }

    for (const event of events) {
      await eventRepository.insert(event);
      await eventBus.publish(event);
    }

    const worker = new BoxScoreWorker(
      { eventBus, events: eventRepository, stats },
      {
        batchSize: events.length,
        blockMs: 1_000,
        consumerGroup,
        consumerName: 'integration-worker',
      },
    );

    await expect(worker.processNextBatch()).resolves.toBe(events.length);
    await expect(stats.listByGameId(game.gameId)).resolves.toEqual([
      {
        gameId: game.gameId,
        playerId: 'player-0',
        lastProcessedSequence: 10,
        points: 6,
        rebounds: 1,
        assists: 1,
        steals: 1,
        blocks: 1,
        turnovers: 1,
        fieldGoalsMade: 2,
        fieldGoalsAttempted: 3,
        threePointersMade: 1,
        threePointersAttempted: 2,
        freeThrowsMade: 1,
        freeThrowsAttempted: 2,
      },
    ]);
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
