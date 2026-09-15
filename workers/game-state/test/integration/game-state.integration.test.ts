import {
  createDatabasePool,
  GameRepository,
  GameStateRepository,
  runMigrations,
} from '@nba-event-platform/database';
import {
  connectRedisEventBus,
  type RedisEventBus,
} from '@nba-event-platform/event-bus';
import type { GameEvent } from '@nba-event-platform/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GameStateWorker } from '../../src/index.js';
import { createEvent, game } from '../fixtures.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
const describeWithServices = databaseUrl && redisUrl ? describe : describe.skip;

describeWithServices('game state worker integration', () => {
  if (!databaseUrl || !redisUrl) {
    return;
  }

  const testId = Date.now();
  const consumerGroup = `game-state-test-${testId}`;
  const integrationGame = {
    ...game,
    gameId: `game-state-integration-${testId}`,
  };
  const events: GameEvent[] = [
    createEvent({ gameId: integrationGame.gameId }),
    createEvent({
      eventId: 'evt-2',
      gameId: integrationGame.gameId,
      sequence: 2,
      eventType: 'shot_made',
      clock: '11:43',
      teamId: integrationGame.homeTeamId,
      points: 3,
    }),
    createEvent({
      eventId: 'evt-3',
      gameId: integrationGame.gameId,
      sequence: 3,
      eventType: 'shot_made',
      clock: '11:22',
      teamId: integrationGame.awayTeamId,
      points: 2,
    }),
    createEvent({
      eventId: 'evt-4',
      gameId: integrationGame.gameId,
      sequence: 4,
      eventType: 'game_end',
      period: 4,
      clock: '0:00',
    }),
  ];
  const database = createDatabasePool({
    applicationName: 'game-state-integration-test',
    connectionString: databaseUrl,
  });
  const states = new GameStateRepository(database);
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
      streamKey: `game-state-events:${testId}`,
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

  it('reconstructs and persists game state from a stream of events', async () => {
    if (!eventBus) {
      throw new Error('event bus was not initialized');
    }

    for (const event of events) {
      await eventBus.publish(event);
    }

    const worker = new GameStateWorker(
      {
        eventBus,
        games: new GameRepository(database),
        states,
      },
      {
        batchSize: events.length,
        blockMs: 1_000,
        consumerGroup,
        consumerName: 'integration-worker',
      },
    );

    await expect(worker.processNextBatch()).resolves.toBe(events.length);
    await expect(states.findByGameId(integrationGame.gameId)).resolves.toEqual({
      gameId: integrationGame.gameId,
      homeTeamId: integrationGame.homeTeamId,
      awayTeamId: integrationGame.awayTeamId,
      homeScore: 3,
      awayScore: 2,
      period: 4,
      clock: '0:00',
      status: 'final',
      lastProcessedSequence: 4,
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
