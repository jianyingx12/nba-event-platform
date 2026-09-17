import { playerSchema, type Player } from '@nba-event-platform/schemas';

import type { Queryable } from './queryable.js';
import { requireRow } from './row.js';

const savePlayerSql = `
  INSERT INTO players (id, display_name, team_id)
  VALUES ($1, $2, $3)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    team_id = EXCLUDED.team_id,
    updated_at = NOW()
  RETURNING *
`;

const findPlayersSql = `
  SELECT * FROM players WHERE id = ANY($1::text[]) ORDER BY id ASC
`;

function mapPlayerRow(value: unknown): Player {
  const row = requireRow(value, 'player');

  return playerSchema.parse({
    playerId: row.id,
    displayName: row.display_name,
    teamId: row.team_id ?? undefined,
  });
}

export class PlayerRepository {
  constructor(private readonly database: Queryable) {}

  async save(player: Player): Promise<Player> {
    const value = playerSchema.parse(player);
    const result = await this.database.query(savePlayerSql, [
      value.playerId,
      value.displayName,
      value.teamId ?? null,
    ]);

    return mapPlayerRow(result.rows[0]);
  }

  async findByIds(playerIds: string[]): Promise<Player[]> {
    if (playerIds.length === 0) return [];

    const result = await this.database.query(findPlayersSql, [playerIds]);
    return result.rows.map(mapPlayerRow);
  }
}
