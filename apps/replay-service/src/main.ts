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

  if (config.source === 'nba' || config.source === 'nba-history') {
    const source = new NbaEventSource();
    if (
      config.source === 'nba' &&
      !(await source.listGames()).some(
        (candidate) => candidate.gameId === config.gameId,
      )
    ) {
      throw new Error(`NBA game ${config.gameId} was not found today`);
    }

    const { game, roster } = await source.getGameDetails(config.gameId);
    if (config.source === 'nba-history' && game.status !== 'final') {
      throw new Error(`NBA game ${config.gameId} is not final`);
    }

    await ingestion.registerGame(game);
    await ingestion.registerRoster(roster);
    gameId = game.gameId;
    eventCount = 0;
    const events =
      config.source === 'nba-history'
        ? await source.getGameEvents(game.gameId)
        : source.streamGame(game.gameId);
    for await (const event of events) {
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
