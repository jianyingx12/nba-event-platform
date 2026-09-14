import { describe, expect, it } from 'vitest';

import { GameStateRepository } from '../../src/index.js';
import { gameState } from './fixtures.js';
import { createTestDatabase } from './test-database.js';

const gameStateRow = {
  game_id: gameState.gameId,
  home_team_id: gameState.homeTeamId,
  away_team_id: gameState.awayTeamId,
  home_score: gameState.homeScore,
  away_score: gameState.awayScore,
  period: gameState.period,
  clock: gameState.clock,
  status: gameState.status,
  last_processed_sequence: gameState.lastProcessedSequence,
};

describe('GameStateRepository', () => {
  it('upserts and returns game state', async () => {
    const { database, query } = createTestDatabase({
      rowCount: 1,
      rows: [gameStateRow],
    });
    const repository = new GameStateRepository(database);

    await expect(repository.save(gameState)).resolves.toEqual(gameState);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (game_id) DO UPDATE'),
      expect.arrayContaining([gameState.gameId, gameState.homeScore]),
    );
  });

  it('returns state by game ID', async () => {
    const { database } = createTestDatabase({
      rowCount: 1,
      rows: [gameStateRow],
    });
    const repository = new GameStateRepository(database);

    await expect(repository.findByGameId(gameState.gameId)).resolves.toEqual(
      gameState,
    );
  });
});
