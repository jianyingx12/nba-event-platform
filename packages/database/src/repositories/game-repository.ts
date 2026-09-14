import { gameSchema, type Game } from '@nba-event-platform/schemas';

import type { Queryable } from './queryable.js';

const upsertGameSql = `
  INSERT INTO games (
    id,
    home_team_id,
    away_team_id,
    scheduled_at,
    started_at,
    status
  )
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (id) DO UPDATE SET
    home_team_id = EXCLUDED.home_team_id,
    away_team_id = EXCLUDED.away_team_id,
    scheduled_at = EXCLUDED.scheduled_at,
    started_at = EXCLUDED.started_at,
    status = EXCLUDED.status,
    updated_at = NOW()
  RETURNING id, home_team_id, away_team_id, scheduled_at, started_at, status
`;

const findGameByIdSql = `
  SELECT id, home_team_id, away_team_id, scheduled_at, started_at, status
  FROM games
  WHERE id = $1
`;

function mapGameRow(value: unknown): Game {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('database returned an invalid game row');
  }

  const row = value as Record<string, unknown>;
  const startedAt = row.started_at;

  return gameSchema.parse({
    gameId: row.id,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    scheduledAt:
      row.scheduled_at instanceof Date
        ? row.scheduled_at.toISOString()
        : row.scheduled_at,
    ...(startedAt === null || startedAt === undefined
      ? {}
      : {
          startedAt:
            startedAt instanceof Date ? startedAt.toISOString() : startedAt,
        }),
    status: row.status,
  });
}

export class GameRepository {
  constructor(private readonly database: Queryable) {}

  async save(game: Game): Promise<Game> {
    const value = gameSchema.parse(game);
    const result = await this.database.query(upsertGameSql, [
      value.gameId,
      value.homeTeamId,
      value.awayTeamId,
      value.scheduledAt,
      value.startedAt ?? null,
      value.status,
    ]);

    if (result.rowCount !== 1 || result.rows[0] === undefined) {
      throw new Error(`failed to save game ${value.gameId}`);
    }

    return mapGameRow(result.rows[0]);
  }

  async findById(gameId: string): Promise<Game | null> {
    const result = await this.database.query(findGameByIdSql, [gameId]);

    return result.rows[0] === undefined ? null : mapGameRow(result.rows[0]);
  }
}
