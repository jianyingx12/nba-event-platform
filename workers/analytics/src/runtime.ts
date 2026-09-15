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

import { loadConfig, type AnalyticsWorkerConfig } from './config.js';
import { AnalyticsWorker } from './worker.js';

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

export async function runAnalyticsWorker(
  config: AnalyticsWorkerConfig = loadConfig(process.env),
  signal: AbortSignal = new AbortController().signal,
): Promise<void> {
  const database = createDatabasePool({
    applicationName: 'analytics-worker',
    connectionString: config.databaseUrl,
    connectionTimeoutMs: 5_000,
  });
  let eventBus: RedisEventBus | undefined;

  try {
    await runMigrations(database);
    eventBus = await connectRedisEventBus({
      url: config.redisUrl,
      onError: (error) => writeErrorLog('redis', error),
    });

    const worker = new AnalyticsWorker(
      {
        analytics: new GameAnalyticsRepository(database),
        eventBus,
        games: new GameRepository(database),
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
