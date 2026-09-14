import { describe, expect, it } from 'vitest';

import { gameStateSchema, playerGameStatsSchema } from '../src/index.js';
import { gameState, playerGameStats } from './fixtures.js';

describe('derived basketball models', () => {
  it('parses game state and player statistics', () => {
    expect(gameStateSchema.parse(gameState)).toEqual(gameState);
    expect(playerGameStatsSchema.parse(playerGameStats)).toEqual(
      playerGameStats,
    );
  });

  it.each([
    ['negative score', gameStateSchema, { ...gameState, homeScore: -1 }],
    [
      'negative statistic',
      playerGameStatsSchema,
      { ...playerGameStats, rebounds: -1 },
    ],
    [
      'made shots above attempts',
      playerGameStatsSchema,
      { ...playerGameStats, fieldGoalsMade: 20 },
    ],
  ])('rejects a %s', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});
