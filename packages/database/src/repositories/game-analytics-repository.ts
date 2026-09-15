import {
  gameAnalyticsSchema,
  type GameAnalytics,
} from '@nba-event-platform/schemas';

import type { Queryable } from './queryable.js';
import { requireRow } from './row.js';

const saveGameAnalyticsSql = `
  INSERT INTO game_analytics (
    game_id, home_team, away_team, last_processed_sequence
  )
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (game_id) DO UPDATE SET
    home_team = EXCLUDED.home_team,
    away_team = EXCLUDED.away_team,
    last_processed_sequence = EXCLUDED.last_processed_sequence,
    updated_at = NOW()
  RETURNING *
`;

const findGameAnalyticsSql = `
  SELECT * FROM game_analytics WHERE game_id = $1
`;

function mapGameAnalyticsRow(value: unknown): GameAnalytics {
  const row = requireRow(value, 'game analytics');

  return gameAnalyticsSchema.parse({
    gameId: row.game_id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    lastProcessedSequence: row.last_processed_sequence,
  });
}

export class GameAnalyticsRepository {
  constructor(private readonly database: Queryable) {}

  async save(analytics: GameAnalytics): Promise<GameAnalytics> {
    const value = gameAnalyticsSchema.parse(analytics);
    const result = await this.database.query(saveGameAnalyticsSql, [
      value.gameId,
      value.homeTeam,
      value.awayTeam,
      value.lastProcessedSequence,
    ]);

    if (result.rowCount !== 1 || result.rows[0] === undefined) {
      throw new Error(`failed to save analytics for ${value.gameId}`);
    }

    return mapGameAnalyticsRow(result.rows[0]);
  }

  async findByGameId(gameId: string): Promise<GameAnalytics | null> {
    const result = await this.database.query(findGameAnalyticsSql, [gameId]);

    return result.rows[0] === undefined
      ? null
      : mapGameAnalyticsRow(result.rows[0]);
  }
}
