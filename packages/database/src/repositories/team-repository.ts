import { teamSchema, type Team } from '@nba-event-platform/schemas';

import type { Queryable } from './queryable.js';
import { requireRow } from './row.js';

const saveTeamSql = `
  INSERT INTO teams (id, abbreviation, city, name)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (id) DO UPDATE SET
    abbreviation = EXCLUDED.abbreviation,
    city = EXCLUDED.city,
    name = EXCLUDED.name,
    updated_at = NOW()
  RETURNING *
`;

const findTeamsSql = `
  SELECT * FROM teams WHERE id = ANY($1::text[]) ORDER BY id ASC
`;

function mapTeamRow(value: unknown): Team {
  const row = requireRow(value, 'team');

  return teamSchema.parse({
    teamId: row.id,
    abbreviation: row.abbreviation,
    city: row.city,
    name: row.name,
  });
}

export class TeamRepository {
  constructor(private readonly database: Queryable) {}

  async save(team: Team): Promise<Team> {
    const value = teamSchema.parse(team);
    const result = await this.database.query(saveTeamSql, [
      value.teamId,
      value.abbreviation,
      value.city,
      value.name,
    ]);

    return mapTeamRow(result.rows[0]);
  }

  async findByIds(teamIds: string[]): Promise<Team[]> {
    if (teamIds.length === 0) return [];

    const result = await this.database.query(findTeamsSql, [teamIds]);
    return result.rows.map(mapTeamRow);
  }
}
