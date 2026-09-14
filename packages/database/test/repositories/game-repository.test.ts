import { describe, expect, it } from 'vitest';

import { GameRepository } from '../../src/index.js';
import { game } from './fixtures.js';
import { createTestDatabase } from './test-database.js';

const gameRow = {
  id: game.gameId,
  home_team_id: game.homeTeamId,
  away_team_id: game.awayTeamId,
  scheduled_at: new Date(game.scheduledAt),
  started_at: new Date(game.startedAt),
  status: game.status,
};

describe('GameRepository', () => {
  it('upserts and returns a game', async () => {
    const { database, query } = createTestDatabase({
      rowCount: 1,
      rows: [gameRow],
    });
    const repository = new GameRepository(database);

    await expect(repository.save(game)).resolves.toEqual(game);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (id) DO UPDATE'),
      [
        game.gameId,
        game.homeTeamId,
        game.awayTeamId,
        game.scheduledAt,
        game.startedAt,
        game.status,
      ],
    );
  });

  it('returns a game by ID', async () => {
    const { database, query } = createTestDatabase({
      rowCount: 1,
      rows: [gameRow],
    });
    const repository = new GameRepository(database);

    await expect(repository.findById(game.gameId)).resolves.toEqual(game);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      [game.gameId],
    );
  });

  it('returns null when a game does not exist', async () => {
    const { database } = createTestDatabase({ rowCount: 0, rows: [] });
    const repository = new GameRepository(database);

    await expect(repository.findById('missing-game')).resolves.toBeNull();
  });
});
