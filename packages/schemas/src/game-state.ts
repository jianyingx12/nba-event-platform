import { z } from 'zod';

import {
  basketballClockSchema,
  identifierSchema,
  nonNegativeIntegerSchema,
} from './common.js';
import { gameStatusSchema } from './game.js';

export const gameStateSchema = z
  .object({
    gameId: identifierSchema,
    homeTeamId: identifierSchema,
    awayTeamId: identifierSchema,
    homeScore: nonNegativeIntegerSchema,
    awayScore: nonNegativeIntegerSchema,
    period: nonNegativeIntegerSchema,
    clock: basketballClockSchema,
    status: gameStatusSchema,
    lastProcessedSequence: nonNegativeIntegerSchema,
  })
  .strict()
  .refine((state) => state.homeTeamId !== state.awayTeamId, {
    path: ['awayTeamId'],
    message: 'home and away teams must be different',
  });

export type GameState = z.infer<typeof gameStateSchema>;
