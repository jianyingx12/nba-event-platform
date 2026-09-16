import {
  playerGameStatsSchema,
  type PlayerGameStats,
} from '@nba-event-platform/schemas';

import type { Queryable } from './queryable.js';
import { requireRow } from './row.js';

const savePlayerGameStatsSql = `
  INSERT INTO player_game_stats (
    game_id, player_id, last_processed_sequence, points, rebounds, assists,
    steals, blocks, turnovers, field_goals_made, field_goals_attempted,
    three_pointers_made, three_pointers_attempted, free_throws_made,
    free_throws_attempted
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
  ON CONFLICT (game_id, player_id) DO UPDATE SET
    last_processed_sequence = EXCLUDED.last_processed_sequence,
    points = EXCLUDED.points,
    rebounds = EXCLUDED.rebounds,
    assists = EXCLUDED.assists,
    steals = EXCLUDED.steals,
    blocks = EXCLUDED.blocks,
    turnovers = EXCLUDED.turnovers,
    field_goals_made = EXCLUDED.field_goals_made,
    field_goals_attempted = EXCLUDED.field_goals_attempted,
    three_pointers_made = EXCLUDED.three_pointers_made,
    three_pointers_attempted = EXCLUDED.three_pointers_attempted,
    free_throws_made = EXCLUDED.free_throws_made,
    free_throws_attempted = EXCLUDED.free_throws_attempted,
    updated_at = NOW()
  WHERE player_game_stats.last_processed_sequence <= EXCLUDED.last_processed_sequence
  RETURNING *
`;

const findPlayerGameStatsSql = `
  SELECT * FROM player_game_stats WHERE game_id = $1 AND player_id = $2
`;

const listPlayerGameStatsSql = `
  SELECT * FROM player_game_stats WHERE game_id = $1 ORDER BY player_id ASC
`;

function mapPlayerGameStatsRow(value: unknown): PlayerGameStats {
  const row = requireRow(value, 'player game stats');

  return playerGameStatsSchema.parse({
    gameId: row.game_id,
    playerId: row.player_id,
    lastProcessedSequence: row.last_processed_sequence,
    points: row.points,
    rebounds: row.rebounds,
    assists: row.assists,
    steals: row.steals,
    blocks: row.blocks,
    turnovers: row.turnovers,
    fieldGoalsMade: row.field_goals_made,
    fieldGoalsAttempted: row.field_goals_attempted,
    threePointersMade: row.three_pointers_made,
    threePointersAttempted: row.three_pointers_attempted,
    freeThrowsMade: row.free_throws_made,
    freeThrowsAttempted: row.free_throws_attempted,
  });
}

export class PlayerGameStatsRepository {
  constructor(private readonly database: Queryable) {}

  async save(stats: PlayerGameStats): Promise<PlayerGameStats> {
    const value = playerGameStatsSchema.parse(stats);
    const result = await this.database.query(savePlayerGameStatsSql, [
      value.gameId,
      value.playerId,
      value.lastProcessedSequence,
      value.points,
      value.rebounds,
      value.assists,
      value.steals,
      value.blocks,
      value.turnovers,
      value.fieldGoalsMade,
      value.fieldGoalsAttempted,
      value.threePointersMade,
      value.threePointersAttempted,
      value.freeThrowsMade,
      value.freeThrowsAttempted,
    ]);

    if (result.rowCount === 0) {
      const current = await this.find(value.gameId, value.playerId);

      if (current !== null) {
        return current;
      }
    }

    if (result.rowCount !== 1 || result.rows[0] === undefined) {
      throw new Error(
        `failed to save stats for ${value.playerId} in ${value.gameId}`,
      );
    }

    return mapPlayerGameStatsRow(result.rows[0]);
  }

  async find(
    gameId: string,
    playerId: string,
  ): Promise<PlayerGameStats | null> {
    const result = await this.database.query(findPlayerGameStatsSql, [
      gameId,
      playerId,
    ]);

    return result.rows[0] === undefined
      ? null
      : mapPlayerGameStatsRow(result.rows[0]);
  }

  async listByGameId(gameId: string): Promise<PlayerGameStats[]> {
    const result = await this.database.query(listPlayerGameStatsSql, [gameId]);

    return result.rows.map(mapPlayerGameStatsRow);
  }
}
