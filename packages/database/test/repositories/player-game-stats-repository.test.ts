import { describe, expect, it } from 'vitest';

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
      expect.stringContaining('ON CONFLICT (game_id, player_id) DO UPDATE'),
      expect.arrayContaining([
        playerGameStats.gameId,
        playerGameStats.playerId,
      ]),
    );
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
