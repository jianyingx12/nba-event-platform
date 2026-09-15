import {
  createDatabasePool,
  GameEventRepository,
  GameRepository,
  runMigrations,
} from '@nba-event-platform/database';
import {
  connectRedisEventBus,
  type RedisEventBus,
} from '@nba-event-platform/event-bus';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startServer } from '../../src/index.js';
import { game, gameEvent } from '../fixtures.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
const describeWithServices = databaseUrl && redisUrl ? describe : describe.skip;

describeWithServices('ingestion API integration', () => {
  if (!databaseUrl || !redisUrl) {
    return;
  }

  const consumerGroup = `ingestion-test-${Date.now()}`;
  const redisErrors: Error[] = [];
  const database = createDatabasePool({
    applicationName: 'ingestion-api-integration-test',
    connectionString: databaseUrl,
  });
  let app: FastifyInstance | undefined;
  let consumer: RedisEventBus | undefined;

  beforeAll(async () => {
    await runMigrations(database);
    await database.query(`
      TRUNCATE TABLE
        processed_events,
        player_game_stats,
        game_state,
        game_events,
        games
      CASCADE
    `);
    await new GameRepository(database).save(game);

    consumer = await connectRedisEventBus({
      url: redisUrl,
      onError: (error) => redisErrors.push(error),
    });
    await consumer.ensureConsumerGroup(consumerGroup);

    app = await startServer({
      databaseUrl,
      host: '127.0.0.1',
      port: 0,
      redisUrl,
    });
  });

  afterAll(async () => {
    await app?.close();
    await consumer?.close();
    await database.end();
  });

  it('reports ready when PostgreSQL and Redis are available', async () => {
    const response = await app?.inject({ method: 'GET', url: '/ready' });

    expect(response?.statusCode).toBe(200);
    expect(response?.json()).toEqual({ status: 'ready' });
  });

  it('persists and publishes an event only once', async () => {
    const accepted = await app?.inject({
      method: 'POST',
      url: '/v1/events',
      payload: gameEvent,
    });

    expect(accepted?.statusCode).toBe(202);
    await expect(
      new GameEventRepository(database).listByGameId(game.gameId),
    ).resolves.toEqual([gameEvent]);

    const messages = await consumer?.read({
      consumerGroup,
      consumerName: 'integration-worker',
      blockMs: 1_000,
    });
    expect(messages).toHaveLength(1);
    expect(messages?.[0]?.event).toEqual(gameEvent);
    await consumer?.acknowledge(consumerGroup, messages?.[0]?.messageId ?? '');

    const duplicate = await app?.inject({
      method: 'POST',
      url: '/v1/events',
      payload: gameEvent,
    });
    expect(duplicate?.statusCode).toBe(200);
    expect(duplicate?.json()).toEqual({
      accepted: false,
      reason: 'duplicate_event',
    });
    await expect(
      consumer?.read({
        consumerGroup,
        consumerName: 'integration-worker',
        blockMs: 50,
      }),
    ).resolves.toEqual([]);
    expect(redisErrors).toEqual([]);
  });
});
