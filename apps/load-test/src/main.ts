import {
  createDatabasePool,
  GameStateRepository,
  PlayerGameStatsRepository,
} from '@nba-event-platform/database';

import { loadConfig } from './config.js';
import { HttpLoadTestIngestionClient } from './ingestion-client.js';
import { runLoadTest } from './runner.js';
import { verifyWorkload } from './verification.js';
import { createWorkload } from './workload.js';

async function main(): Promise<void> {
  const config = loadConfig(process.argv.slice(2));
  const workload = createWorkload({
    duplicateRate: config.duplicateRate,
    eventsPerGame: config.eventsPerGame,
    games: config.games,
    runId: config.runId,
  });
  const client = new HttpLoadTestIngestionClient(config.baseUrl);
  const report = await runLoadTest(workload, client, config.concurrency);
  const verification = config.databaseUrl
    ? await verifyWithDatabase(config.databaseUrl, workload)
    : { status: 'skipped' as const, reason: 'DATABASE_URL is not set' };

  process.stdout.write(
    `${JSON.stringify(
      {
        runId: config.runId,
        games: config.games,
        eventsPerGame: config.eventsPerGame,
        concurrency: config.concurrency,
        duplicateRate: config.duplicateRate,
        ...report,
        verification,
      },
      null,
      2,
    )}\n`,
  );

  if (report.failedRequests > 0) {
    process.exitCode = 1;
  }
}

async function verifyWithDatabase(
  databaseUrl: string,
  workload: ReturnType<typeof createWorkload>,
) {
  const database = createDatabasePool({
    applicationName: 'load-test',
    connectionString: databaseUrl,
    connectionTimeoutMs: 5_000,
  });

  try {
    const states = new GameStateRepository(database);
    const stats = new PlayerGameStatsRepository(database);

    return await verifyWorkload(workload, {
      findGameState: (gameId) => states.findByGameId(gameId),
      listPlayerGameStats: (gameId) => stats.listByGameId(gameId),
    });
  } finally {
    await database.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
