import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createDatabasePool,
  GameEventRepository,
  GameRepository,
  GameStateRepository,
  PlayerGameStatsRepository,
  ProcessedEventRepository,
  runMigrations,
} from '../../src/index.js';
import {
  game,
  gameEvent,
  gameState,
  playerGameStats,
} from '../repositories/fixtures.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('PostgreSQL persistence', () => {
  if (!databaseUrl) {
    return;
  }

  const pool = createDatabasePool({
    connectionString: databaseUrl,
    applicationName: 'database-integration-test',
    connectionTimeoutMs: 5_000,
  });

  beforeAll(async () => {
    await runMigrations(pool);
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        processed_events,
        player_game_stats,
        game_state,
        game_events,
        games
      CASCADE
    `);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('persists and retrieves canonical game data', async () => {
    const games = new GameRepository(pool);
    const events = new GameEventRepository(pool);
    const states = new GameStateRepository(pool);
    const stats = new PlayerGameStatsRepository(pool);
    const processedEvents = new ProcessedEventRepository(pool);

    await expect(games.save(game)).resolves.toEqual(game);
    await expect(games.findById(game.gameId)).resolves.toEqual(game);

    await expect(events.insert(gameEvent)).resolves.toBe(true);
    await expect(events.insert(gameEvent)).resolves.toBe(false);
    await expect(events.listByGameId(game.gameId)).resolves.toEqual([
      gameEvent,
    ]);

    await expect(states.save(gameState)).resolves.toEqual(gameState);
    await expect(states.findByGameId(game.gameId)).resolves.toEqual(gameState);

    await expect(stats.save(playerGameStats)).resolves.toEqual(playerGameStats);
    await expect(stats.listByGameId(game.gameId)).resolves.toEqual([
      playerGameStats,
    ]);

    await expect(
      processedEvents.markProcessed('game-state', gameEvent.eventId),
    ).resolves.toBe(true);
    await expect(
      processedEvents.markProcessed('game-state', gameEvent.eventId),
    ).resolves.toBe(false);
    await expect(
      processedEvents.hasProcessed('game-state', gameEvent.eventId),
    ).resolves.toBe(true);
  });
});
