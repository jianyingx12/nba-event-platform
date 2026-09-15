import { describe, expect, it } from 'vitest';

import { GameAnalyticsRepository } from '../../src/index.js';
import { gameAnalytics } from './fixtures.js';
import { createTestDatabase } from './test-database.js';

const analyticsRow = {
  game_id: gameAnalytics.gameId,
  home_team: gameAnalytics.homeTeam,
  away_team: gameAnalytics.awayTeam,
  last_processed_sequence: gameAnalytics.lastProcessedSequence,
};

describe('GameAnalyticsRepository', () => {
  it('upserts and returns game analytics', async () => {
    const { database, query } = createTestDatabase({
      rowCount: 1,
      rows: [analyticsRow],
    });
    const repository = new GameAnalyticsRepository(database);

    await expect(repository.save(gameAnalytics)).resolves.toEqual(
      gameAnalytics,
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (game_id) DO UPDATE'),
      [
        gameAnalytics.gameId,
        gameAnalytics.homeTeam,
        gameAnalytics.awayTeam,
        gameAnalytics.lastProcessedSequence,
      ],
    );
  });

  it('returns analytics by game ID', async () => {
    const { database } = createTestDatabase({
      rowCount: 1,
      rows: [analyticsRow],
    });
    const repository = new GameAnalyticsRepository(database);

    await expect(
      repository.findByGameId(gameAnalytics.gameId),
    ).resolves.toEqual(gameAnalytics);
  });

  it('returns null when a game has no analytics', async () => {
    const { database } = createTestDatabase({ rowCount: 0, rows: [] });
    const repository = new GameAnalyticsRepository(database);

    await expect(repository.findByGameId('missing-game')).resolves.toBeNull();
  });
});
