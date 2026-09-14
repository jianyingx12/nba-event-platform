import {
  createDatabasePool,
  GameEventRepository,
  runMigrations,
} from '@nba-event-platform/database';
import {
  connectRedisEventBus,
  type RedisEventBus,
} from '@nba-event-platform/event-bus';
import type { FastifyInstance } from 'fastify';

import { buildApp } from './app.js';
import { loadConfig, type IngestionApiConfig } from './config.js';

export async function startServer(
  config: IngestionApiConfig = loadConfig(process.env),
): Promise<FastifyInstance> {
  const database = createDatabasePool({
    applicationName: 'ingestion-api',
    connectionString: config.databaseUrl,
    connectionTimeoutMs: 5_000,
  });
  let eventBus: RedisEventBus | undefined;

  try {
    await runMigrations(database);
    eventBus = await connectRedisEventBus({
      url: config.redisUrl,
      onError: logRedisError,
    });
    const connectedEventBus = eventBus;

    const app = buildApp({
      eventBus: connectedEventBus,
      eventStore: new GameEventRepository(database),
      logger: true,
      readinessCheck: async () => {
        if (!connectedEventBus.isReady()) {
          return false;
        }

        await database.query('SELECT 1');
        return true;
      },
    });

    app.addHook('onClose', async () => {
      await Promise.all([connectedEventBus.close(), database.end()]);
    });

    await app.listen({ host: config.host, port: config.port });
    return app;
  } catch (error) {
    await eventBus?.close();
    await database.end();
    throw error;
  }
}

function logRedisError(error: Error): void {
  process.stderr.write(
    `${JSON.stringify({
      level: 'error',
      component: 'redis',
      message: error.message,
    })}\n`,
  );
}
