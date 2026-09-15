import { loadConfig } from './config.js';
import { readReplayFixture } from './fixture.js';
import { HttpEventIngestionClient } from './ingestion-client.js';
import { replayFixture } from './replay.js';

try {
  const config = loadConfig(process.argv.slice(2), process.env);
  const fixture = await readReplayFixture(config.fixturePath);
  const ingestion = new HttpEventIngestionClient(config.ingestionApiUrl);
  await ingestion.registerGame(fixture.game);
  const eventCount = await replayFixture(fixture, ingestion, {
    speed: config.speed,
  });

  process.stdout.write(
    `${JSON.stringify({ eventCount, gameId: fixture.game.gameId })}\n`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${JSON.stringify({ level: 'error', service: 'replay-service', message })}\n`,
  );
  process.exitCode = 1;
}
