import { loadConfig } from './config.js';
import { HttpLoadTestIngestionClient } from './ingestion-client.js';
import { runLoadTest } from './runner.js';
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

  process.stdout.write(
    `${JSON.stringify(
      {
        runId: config.runId,
        games: config.games,
        eventsPerGame: config.eventsPerGame,
        concurrency: config.concurrency,
        duplicateRate: config.duplicateRate,
        ...report,
      },
      null,
      2,
    )}\n`,
  );

  if (report.failedRequests > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
