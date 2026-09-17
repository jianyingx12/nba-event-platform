import { gameEventSchema, type GameEvent } from '@nba-event-platform/schemas';

import type { Queryable } from './queryable.js';

const insertGameEventSql = `
  INSERT INTO game_events (
    event_id,
    game_id,
    sequence,
    event_type,
    occurred_at,
    period,
    clock,
    source,
    source_event_id,
    payload
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  ON CONFLICT DO NOTHING
  RETURNING event_id
`;

const listGameEventsSql = `
  SELECT payload
  FROM game_events
  WHERE game_id = $1
  ORDER BY sequence ASC
`;

const listRecentGameEventsSql = `
  SELECT payload
  FROM game_events
  WHERE game_id = $1
  ORDER BY sequence DESC
  LIMIT $2
`;

function mapGameEventRow(value: unknown): GameEvent {
  if (typeof value !== 'object' || value === null || !('payload' in value)) {
    throw new TypeError('database returned an invalid game event row');
  }

  return gameEventSchema.parse(value.payload);
}

export class GameEventRepository {
  constructor(private readonly database: Queryable) {}

  async insert(event: GameEvent): Promise<boolean> {
    const value = gameEventSchema.parse(event);
    const result = await this.database.query(insertGameEventSql, [
      value.eventId,
      value.gameId,
      value.sequence,
      value.eventType,
      value.occurredAt,
      value.period,
      value.clock,
      value.source,
      value.sourceEventId ?? null,
      value,
    ]);

    return result.rowCount === 1;
  }

  async listByGameId(gameId: string): Promise<GameEvent[]> {
    const result = await this.database.query(listGameEventsSql, [gameId]);

    return result.rows.map(mapGameEventRow);
  }

  async listRecentByGameId(gameId: string, limit = 25): Promise<GameEvent[]> {
    const result = await this.database.query(listRecentGameEventsSql, [
      gameId,
      limit,
    ]);

    return result.rows.map(mapGameEventRow);
  }
}
