import { describe, expect, it } from 'vitest';

import { PlayerRepository } from '../../src/index.js';
import { player } from './fixtures.js';
import { createTestDatabase } from './test-database.js';

const playerRow = {
  id: player.playerId,
  display_name: player.displayName,
  team_id: player.teamId,
};

describe('PlayerRepository', () => {
  it('upserts and returns a player', async () => {
    const { database, query } = createTestDatabase({
      rowCount: 1,
      rows: [playerRow],
    });
    const repository = new PlayerRepository(database);

    await expect(repository.save(player)).resolves.toEqual(player);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (id) DO UPDATE'),
      [player.playerId, player.displayName, player.teamId],
    );
  });

  it('returns players matching a list of IDs', async () => {
    const { database, query } = createTestDatabase({
      rowCount: 1,
      rows: [playerRow],
    });
    const repository = new PlayerRepository(database);

    await expect(repository.findByIds([player.playerId])).resolves.toEqual([
      player,
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ANY($1'), [
      [player.playerId],
    ]);
  });

  it('does not query for an empty ID list', async () => {
    const { database, query } = createTestDatabase({ rowCount: 0, rows: [] });
    const repository = new PlayerRepository(database);

    await expect(repository.findByIds([])).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
