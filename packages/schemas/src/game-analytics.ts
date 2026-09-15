import { z } from 'zod';

import { identifierSchema, nonNegativeIntegerSchema } from './common.js';

const percentageSchema = z.number().min(0).max(1);

export const teamAnalyticsSchema = z
  .object({
    teamId: identifierSchema,
    points: nonNegativeIntegerSchema,
    turnovers: nonNegativeIntegerSchema,
    fieldGoalsMade: nonNegativeIntegerSchema,
    fieldGoalsAttempted: nonNegativeIntegerSchema,
    fieldGoalPercentage: percentageSchema,
    threePointersMade: nonNegativeIntegerSchema,
    threePointersAttempted: nonNegativeIntegerSchema,
    threePointPercentage: percentageSchema,
    freeThrowsMade: nonNegativeIntegerSchema,
    freeThrowsAttempted: nonNegativeIntegerSchema,
    freeThrowPercentage: percentageSchema,
  })
  .strict()
  .refine((team) => team.fieldGoalsMade <= team.fieldGoalsAttempted, {
    path: ['fieldGoalsMade'],
    message: 'field goals made cannot exceed attempts',
  })
  .refine((team) => team.threePointersMade <= team.threePointersAttempted, {
    path: ['threePointersMade'],
    message: 'three-pointers made cannot exceed attempts',
  })
  .refine((team) => team.freeThrowsMade <= team.freeThrowsAttempted, {
    path: ['freeThrowsMade'],
    message: 'free throws made cannot exceed attempts',
  });

export const gameAnalyticsSchema = z
  .object({
    gameId: identifierSchema,
    homeTeam: teamAnalyticsSchema,
    awayTeam: teamAnalyticsSchema,
    lastProcessedSequence: nonNegativeIntegerSchema,
  })
  .strict()
  .refine(
    (analytics) => analytics.homeTeam.teamId !== analytics.awayTeam.teamId,
    {
      path: ['awayTeam', 'teamId'],
      message: 'home and away teams must be different',
    },
  );

export type TeamAnalytics = z.infer<typeof teamAnalyticsSchema>;
export type GameAnalytics = z.infer<typeof gameAnalyticsSchema>;
