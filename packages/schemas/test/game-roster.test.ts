import { describe, expect, it } from 'vitest';

import { gameRosterSchema } from '../src/index.js';
import { awayTeam, game, homeTeam, player } from './fixtures.js';

const roster = {
  gameId: game.gameId,
  teams: [homeTeam, awayTeam],
  players: [player],
};

describe('game roster schema', () => {
  it('accepts teams and their players', () => {
    expect(gameRosterSchema.parse(roster)).toEqual(roster);
  });

  it('rejects a player from a different team', () => {
    expect(() =>
      gameRosterSchema.parse({
        ...roster,
        players: [{ ...player, teamId: 'other-team' }],
      }),
    ).toThrow('player team must belong to the game');
  });
});
