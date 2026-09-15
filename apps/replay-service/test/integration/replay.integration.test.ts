import { buildApp } from '@nba-event-platform/ingestion-api';
import {
  createDatabasePool,
  GameEventRepository,
  GameRepository,
  GameStateRepository,
  PlayerGameStatsRepository,
  runMigrations,
} from '@nba-event-platform/database';
import {
  connectRedisEventBus,
  type RedisEventBus,
} from '@nba-event-platform/event-bus';
import { BoxScoreWorker } from '@nba-event-platform/box-score-worker';
import { GameStateWorker } from '@nba-event-platform/game-state-worker';
import type { GameEvent } from '@nba-event-platform/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  HttpEventIngestionClient,
  replayFixture,
  type ReplayFixture,
} from '../../src/index.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
const describeWithServices = databaseUrl && redisUrl ? describe : describe.skip;

describeWithServices('replay integration', () => {
  if (!databaseUrl || !redisUrl) {
    return;
  }

  const testId = Date.now();
  const streamKey = `replay-events:${testId}`;
  const fixture = createFixture(testId);
  const database = createDatabasePool({
    applicationName: 'replay-integration-test',
    connectionString: databaseUrl,
  });
  const events = new GameEventRepository(database);
  const games = new GameRepository(database);
  const states = new GameStateRepository(database);
  const stats = new PlayerGameStatsRepository(database);
  const redisErrors: Error[] = [];
  const eventBuses: RedisEventBus[] = [];
  let app: ReturnType<typeof buildApp> | undefined;
  let ingestionUrl: string | undefined;
  let publisher: RedisEventBus | undefined;
  let gameStateBus: RedisEventBus | undefined;
  let boxScoreBus: RedisEventBus | undefined;

  beforeAll(async () => {
    await runMigrations(database);
    await database.query('DELETE FROM games WHERE id = $1', [
      fixture.game.gameId,
    ]);
    await games.save(fixture.game);

    [publisher, gameStateBus, boxScoreBus] = await Promise.all(
      Array.from({ length: 3 }, async () => {
        const eventBus = await connectRedisEventBus({
          url: redisUrl,
          streamKey,
          onError: (error) => redisErrors.push(error),
        });
        eventBuses.push(eventBus);
        return eventBus;
      }),
    );

    if (!publisher) {
      throw new Error('publisher was not initialized');
    }

    app = buildApp({ eventBus: publisher, eventStore: events });
    ingestionUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all(eventBuses.map((eventBus) => eventBus.close()));
    await database.query('DELETE FROM games WHERE id = $1', [
      fixture.game.gameId,
    ]);
    await database.end();
  });

  it('processes a complete fixture through ingestion and both workers', async () => {
    if (!ingestionUrl || !gameStateBus || !boxScoreBus) {
      throw new Error('integration services were not initialized');
    }

    const eventCount = await replayFixture(
      fixture,
      new HttpEventIngestionClient(ingestionUrl),
      { speed: 'max' },
    );
    const gameStateWorker = new GameStateWorker(
      { eventBus: gameStateBus, games, states },
      {
        batchSize: eventCount,
        blockMs: 1_000,
        consumerGroup: `replay-game-state-${testId}`,
        consumerName: 'integration-worker',
      },
    );
    const boxScoreWorker = new BoxScoreWorker(
      { eventBus: boxScoreBus, stats },
      {
        batchSize: eventCount,
        blockMs: 1_000,
        consumerGroup: `replay-box-score-${testId}`,
        consumerName: 'integration-worker',
      },
    );

    await expect(gameStateWorker.processNextBatch()).resolves.toBe(eventCount);
    await expect(boxScoreWorker.processNextBatch()).resolves.toBe(eventCount);
    await expect(events.listByGameId(fixture.game.gameId)).resolves.toEqual(
      fixture.events,
    );
    await expect(states.findByGameId(fixture.game.gameId)).resolves.toEqual({
      gameId: fixture.game.gameId,
      homeTeamId: 'BOS',
      awayTeamId: 'NYK',
      homeScore: 4,
      awayScore: 0,
      period: 4,
      clock: '0:00',
      status: 'final',
      lastProcessedSequence: 5,
    });
    await expect(stats.listByGameId(fixture.game.gameId)).resolves.toEqual([
      {
        gameId: fixture.game.gameId,
        playerId: 'player-0',
        points: 4,
        rebounds: 1,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fieldGoalsMade: 1,
        fieldGoalsAttempted: 1,
        threePointersMade: 1,
        threePointersAttempted: 1,
        freeThrowsMade: 1,
        freeThrowsAttempted: 1,
      },
    ]);
    expect(redisErrors).toEqual([]);
  });
});

function createFixture(testId: number): ReplayFixture {
  const gameId = `replay-integration-${testId}`;
  const eventDetails = [
    { eventType: 'period_start', period: 1, clock: '12:00' },
    {
      eventType: 'shot_made',
      period: 1,
      clock: '11:40',
      teamId: 'BOS',
      playerId: 'player-0',
      points: 3,
    },
    {
      eventType: 'rebound',
      period: 1,
      clock: '11:10',
      teamId: 'BOS',
      playerId: 'player-0',
    },
    {
      eventType: 'free_throw_made',
      period: 1,
      clock: '10:52',
      teamId: 'BOS',
      playerId: 'player-0',
      points: 1,
    },
    { eventType: 'game_end', period: 4, clock: '0:00' },
  ] as const;
  const events: GameEvent[] = eventDetails.map((details, index) => ({
    eventId: `replay-integration-event-${testId}-${index + 1}`,
    gameId,
    sequence: index + 1,
    occurredAt: `2026-01-15T00:05:0${index}.000Z`,
    description: `Replay integration event ${index + 1}`,
    source: 'historical-replay',
    ...details,
  }));

  return {
    game: {
      gameId,
      homeTeamId: 'BOS',
      awayTeamId: 'NYK',
      scheduledAt: '2026-01-15T00:00:00.000Z',
      startedAt: '2026-01-15T00:05:00.000Z',
      status: 'live',
    },
    events,
  };
}
