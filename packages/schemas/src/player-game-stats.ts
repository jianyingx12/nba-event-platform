import { z } from 'zod';

import { identifierSchema, nonNegativeIntegerSchema } from './common.js';

export const playerGameStatsSchema = z
  .object({
    playerId: identifierSchema,
    gameId: identifierSchema,
    points: nonNegativeIntegerSchema,
    rebounds: nonNegativeIntegerSchema,
    assists: nonNegativeIntegerSchema,
    steals: nonNegativeIntegerSchema,
    blocks: nonNegativeIntegerSchema,
    turnovers: nonNegativeIntegerSchema,
    fieldGoalsMade: nonNegativeIntegerSchema,
    fieldGoalsAttempted: nonNegativeIntegerSchema,
    threePointersMade: nonNegativeIntegerSchema,
    threePointersAttempted: nonNegativeIntegerSchema,
    freeThrowsMade: nonNegativeIntegerSchema,
    freeThrowsAttempted: nonNegativeIntegerSchema,
  })
  .strict()
  .refine((stats) => stats.fieldGoalsMade <= stats.fieldGoalsAttempted, {
    path: ['fieldGoalsMade'],
    message: 'field goals made cannot exceed attempts',
  })
  .refine((stats) => stats.threePointersMade <= stats.threePointersAttempted, {
    path: ['threePointersMade'],
    message: 'three-pointers made cannot exceed attempts',
  })
  .refine((stats) => stats.freeThrowsMade <= stats.freeThrowsAttempted, {
    path: ['freeThrowsMade'],
    message: 'free throws made cannot exceed attempts',
  });

export type PlayerGameStats = z.infer<typeof playerGameStatsSchema>;
