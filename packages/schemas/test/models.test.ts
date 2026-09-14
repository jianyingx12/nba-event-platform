import { describe, expect, it } from 'vitest';

import { gameSchema, playerSchema, teamSchema } from '../src/index.js';
import { awayTeam, game, homeTeam, player } from './fixtures.js';

describe('core basketball models', () => {
  it('parses teams, players, and games', () => {
    expect(teamSchema.parse(homeTeam)).toEqual(homeTeam);
    expect(teamSchema.parse(awayTeam)).toEqual(awayTeam);
    expect(playerSchema.parse(player)).toEqual(player);
    expect(gameSchema.parse(game)).toEqual(game);
  });

  it('requires different home and away teams', () => {
    const result = gameSchema.safeParse({
      ...game,
      awayTeamId: game.homeTeamId,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['awayTeamId'],
          message: 'home and away teams must be different',
        }),
      );
    }
  });

  it.each([
    [
      'lowercase team abbreviation',
      teamSchema,
      { ...homeTeam, abbreviation: 'bos' },
    ],
    ['blank player name', playerSchema, { ...player, displayName: ' ' }],
    ['unknown game status', gameSchema, { ...game, status: 'paused' }],
  ])('rejects a %s', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});
