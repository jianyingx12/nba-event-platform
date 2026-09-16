import {
  createDatabasePool,
  GameEventRepository,
  PlayerGameStatsRepository,
  runMigrations,
} from '@nba-event-platform/database';
import {
  connectRedisEventBus,
  type RedisEventBus,
} from '@nba-event-platform/event-bus';
import {
  closeHealthServer,
  startHealthServer,
} from '@nba-event-platform/health';
import type { Server } from 'node:http';

import { BoxScoreWorker } from './worker.js';
import { loadConfig, type BoxScoreWorkerConfig } from './config.js';

export interface BatchProcessor {
  processNextBatch(): Promise<number>;
}

export async function runWorkerLoop(
  worker: BatchProcessor,
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted) {
    await worker.processNextBatch();
  }
}

export async function runBoxScoreWorker(
  config: BoxScoreWorkerConfig = loadConfig(process.env),
  signal: AbortSignal = new AbortController().signal,
): Promise<void> {
  const database = createDatabasePool({
    applicationName: 'box-score-worker',
    connectionString: config.databaseUrl,
    connectionTimeoutMs: 5_000,
  });
  let eventBus: RedisEventBus | undefined;
  let healthServer: Server | undefined;

  try {
    await runMigrations(database);
    eventBus = await connectRedisEventBus({
      url: config.redisUrl,
      onError: (error) => writeErrorLog('redis', error),
    });
    const connectedEventBus = eventBus;
    healthServer = await startHealthServer({
      host: config.healthHost,
      port: config.healthPort,
      readinessCheck: async () => {
        if (!connectedEventBus.isReady()) {
          return false;
        }

        await database.query('SELECT 1');
        return true;
      },
    });

    const worker = new BoxScoreWorker(
      {
        eventBus,
        events: new GameEventRepository(database),
        stats: new PlayerGameStatsRepository(database),
      },
      {
        batchSize: config.batchSize,
        blockMs: config.blockMs,
        claimIdleMs: config.claimIdleMs,
        consumerName: config.consumerName,
        maxAttempts: config.maxAttempts,
        retryDelayMs: config.retryDelayMs,
      },
    );

    await runWorkerLoop(worker, signal);
  } finally {
    if (healthServer) {
      await closeHealthServer(healthServer);
    }
    await eventBus?.close();
    await database.end();
  }
}

export function writeErrorLog(component: string, error: unknown): void {
  process.stderr.write(
    `${JSON.stringify({
      level: 'error',
      component,
      message: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
}
