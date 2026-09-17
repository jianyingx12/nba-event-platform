import { describe, expect, it } from 'vitest';

import { TeamRepository } from '../../src/index.js';
import { homeTeam } from './fixtures.js';
import { createTestDatabase } from './test-database.js';

const teamRow = {
  id: homeTeam.teamId,
  abbreviation: homeTeam.abbreviation,
  city: homeTeam.city,
  name: homeTeam.name,
};

describe('TeamRepository', () => {
  it('upserts and returns a team', async () => {
    const { database, query } = createTestDatabase({
      rowCount: 1,
      rows: [teamRow],
    });
    const repository = new TeamRepository(database);

    await expect(repository.save(homeTeam)).resolves.toEqual(homeTeam);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (id) DO UPDATE'),
      [homeTeam.teamId, homeTeam.abbreviation, homeTeam.city, homeTeam.name],
    );
  });

  it('returns teams matching a list of IDs', async () => {
    const { database, query } = createTestDatabase({
      rowCount: 1,
      rows: [teamRow],
    });
    const repository = new TeamRepository(database);

    await expect(repository.findByIds([homeTeam.teamId])).resolves.toEqual([
      homeTeam,
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ANY($1'), [
      [homeTeam.teamId],
    ]);
  });

  it('does not query for an empty ID list', async () => {
    const { database, query } = createTestDatabase({ rowCount: 0, rows: [] });
    const repository = new TeamRepository(database);

    await expect(repository.findByIds([])).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
