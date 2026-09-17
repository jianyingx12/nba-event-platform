import {
  createDatabasePool,
  GameAnalyticsRepository,
  GameEventRepository,
  GameRepository,
  GameStateRepository,
  PlayerGameStatsRepository,
  PlayerRepository,
  runMigrations,
  TeamRepository,
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
    const analytics = new GameAnalyticsRepository(database);
    const events = new GameEventRepository(database);
    const games = new GameRepository(database);
    const gameStates = new GameStateRepository(database);
    const playerStats = new PlayerGameStatsRepository(database);
    const players = new PlayerRepository(database);
    const teams = new TeamRepository(database);

    const app = buildApp({
      dashboardReader: {
        findAnalytics: (gameId) => analytics.findByGameId(gameId),
        findGame: (gameId) => games.findById(gameId),
        findState: (gameId) => gameStates.findByGameId(gameId),
        listPlayerStats: (gameId) => playerStats.listByGameId(gameId),
        listRecentEvents: (gameId) => events.listRecentByGameId(gameId),
      },
      eventBus: connectedEventBus,
      eventStore: events,
      gameStore: games,
      logger: true,
      rosterStore: {
        save: async (roster) => {
          await Promise.all(roster.teams.map((team) => teams.save(team)));
          await Promise.all(
            roster.players.map((player) => players.save(player)),
          );
        },
      },
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
