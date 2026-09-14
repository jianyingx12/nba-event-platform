import { gameStateSchema, type GameState } from '@nba-event-platform/schemas';

import type { Queryable } from './queryable.js';
import { requireRow } from './row.js';

const saveGameStateSql = `
  INSERT INTO game_state (
    game_id, home_team_id, away_team_id, home_score, away_score,
    period, clock, status, last_processed_sequence
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  ON CONFLICT (game_id) DO UPDATE SET
    home_team_id = EXCLUDED.home_team_id,
    away_team_id = EXCLUDED.away_team_id,
    home_score = EXCLUDED.home_score,
    away_score = EXCLUDED.away_score,
    period = EXCLUDED.period,
    clock = EXCLUDED.clock,
    status = EXCLUDED.status,
    last_processed_sequence = EXCLUDED.last_processed_sequence,
    updated_at = NOW()
  RETURNING *
`;

const findGameStateSql = `
  SELECT * FROM game_state WHERE game_id = $1
`;

function mapGameStateRow(value: unknown): GameState {
  const row = requireRow(value, 'game state');

  return gameStateSchema.parse({
    gameId: row.game_id,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    homeScore: row.home_score,
    awayScore: row.away_score,
    period: row.period,
    clock: row.clock,
    status: row.status,
    lastProcessedSequence: row.last_processed_sequence,
  });
}

export class GameStateRepository {
  constructor(private readonly database: Queryable) {}

  async save(state: GameState): Promise<GameState> {
    const value = gameStateSchema.parse(state);
    const result = await this.database.query(saveGameStateSql, [
      value.gameId,
      value.homeTeamId,
      value.awayTeamId,
      value.homeScore,
      value.awayScore,
      value.period,
      value.clock,
      value.status,
      value.lastProcessedSequence,
    ]);

    if (result.rowCount !== 1 || result.rows[0] === undefined) {
      throw new Error(`failed to save game state for ${value.gameId}`);
    }

    return mapGameStateRow(result.rows[0]);
  }

  async findByGameId(gameId: string): Promise<GameState | null> {
    const result = await this.database.query(findGameStateSql, [gameId]);

    return result.rows[0] === undefined
      ? null
      : mapGameStateRow(result.rows[0]);
  }
}
