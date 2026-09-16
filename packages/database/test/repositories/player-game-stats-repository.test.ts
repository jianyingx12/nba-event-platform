import { describe, expect, it, vi } from 'vitest';

import { PlayerGameStatsRepository } from '../../src/index.js';
import { playerGameStats } from './fixtures.js';
import { createTestDatabase } from './test-database.js';

const statsRow = {
  game_id: playerGameStats.gameId,
  player_id: playerGameStats.playerId,
  last_processed_sequence: playerGameStats.lastProcessedSequence,
  points: playerGameStats.points,
  rebounds: playerGameStats.rebounds,
  assists: playerGameStats.assists,
  steals: playerGameStats.steals,
  blocks: playerGameStats.blocks,
  turnovers: playerGameStats.turnovers,
  field_goals_made: playerGameStats.fieldGoalsMade,
  field_goals_attempted: playerGameStats.fieldGoalsAttempted,
  three_pointers_made: playerGameStats.threePointersMade,
  three_pointers_attempted: playerGameStats.threePointersAttempted,
  free_throws_made: playerGameStats.freeThrowsMade,
  free_throws_attempted: playerGameStats.freeThrowsAttempted,
};

describe('PlayerGameStatsRepository', () => {
  it('upserts and returns player statistics', async () => {
    const { database, query } = createTestDatabase({
      rowCount: 1,
      rows: [statsRow],
    });
    const repository = new PlayerGameStatsRepository(database);

    await expect(repository.save(playerGameStats)).resolves.toEqual(
      playerGameStats,
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'WHERE player_game_stats.last_processed_sequence <= EXCLUDED.last_processed_sequence',
      ),
      expect.arrayContaining([
        playerGameStats.gameId,
        playerGameStats.playerId,
      ]),
    );
  });

  it('keeps newer stored statistics when an older write loses a race', async () => {
    const newerStats = {
      ...playerGameStats,
      lastProcessedSequence: playerGameStats.lastProcessedSequence + 1,
    };
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            ...statsRow,
            last_processed_sequence: newerStats.lastProcessedSequence,
          },
        ],
      });
    const repository = new PlayerGameStatsRepository({ query });

    await expect(repository.save(playerGameStats)).resolves.toEqual(newerStats);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('returns one player or all players for a game', async () => {
    const { database, query } = createTestDatabase({
      rowCount: 1,
      rows: [statsRow],
    });
    const repository = new PlayerGameStatsRepository(database);

    await expect(
      repository.find(playerGameStats.gameId, playerGameStats.playerId),
    ).resolves.toEqual(playerGameStats);
    await expect(
      repository.listByGameId(playerGameStats.gameId),
    ).resolves.toEqual([playerGameStats]);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('ORDER BY player_id ASC'),
      [playerGameStats.gameId],
    );
  });
});
