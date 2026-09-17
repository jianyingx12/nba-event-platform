import { loadConfig } from './config.js';
import { readReplayFixture } from './fixture.js';
import { HttpEventIngestionClient } from './ingestion-client.js';
import { NbaEventSource } from './nba-event-source.js';
import { replayFixture } from './replay.js';

try {
  const config = loadConfig(process.argv.slice(2), process.env);
  const ingestion = new HttpEventIngestionClient(config.ingestionApiUrl);
  let gameId: string;
  let eventCount: number;

  if (config.source === 'nba') {
    const source = new NbaEventSource();
    const game = (await source.listGames()).find(
      (candidate) => candidate.gameId === config.gameId,
    );
    if (!game) throw new Error(`NBA game ${config.gameId} was not found today`);

    await ingestion.registerGame(game);
    gameId = game.gameId;
    eventCount = 0;
    for await (const event of source.streamGame(game.gameId)) {
      await ingestion.submit(event);
      eventCount += 1;
    }
  } else {
    const fixture = await readReplayFixture(config.fixturePath);
    await ingestion.registerGame(fixture.game);
    gameId = fixture.game.gameId;
    eventCount = await replayFixture(fixture, ingestion, {
      speed: config.speed,
    });
  }

  process.stdout.write(`${JSON.stringify({ eventCount, gameId })}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${JSON.stringify({ level: 'error', service: 'replay-service', message })}\n`,
  );
  process.exitCode = 1;
}
