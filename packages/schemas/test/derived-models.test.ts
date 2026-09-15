import { describe, expect, it } from 'vitest';

import {
  gameAnalyticsSchema,
  gameStateSchema,
  playerGameStatsSchema,
} from '../src/index.js';
import { gameAnalytics, gameState, playerGameStats } from './fixtures.js';

describe('derived basketball models', () => {
  it('parses game state and player statistics', () => {
    expect(gameStateSchema.parse(gameState)).toEqual(gameState);
    expect(playerGameStatsSchema.parse(playerGameStats)).toEqual(
      playerGameStats,
    );
    expect(gameAnalyticsSchema.parse(gameAnalytics)).toEqual(gameAnalytics);
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
    [
      'analytics percentage above one',
      gameAnalyticsSchema,
      {
        ...gameAnalytics,
        homeTeam: { ...gameAnalytics.homeTeam, fieldGoalPercentage: 1.1 },
      },
    ],
  ])('rejects a %s', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});
