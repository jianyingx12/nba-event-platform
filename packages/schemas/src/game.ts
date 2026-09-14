import { z } from 'zod';

import { identifierSchema } from './common.js';

export const GAME_STATUSES = [
  'scheduled',
  'live',
  'final',
  'postponed',
  'cancelled',
] as const;

export const gameStatusSchema = z.enum(GAME_STATUSES);

export const gameSchema = z
  .object({
    gameId: identifierSchema,
    homeTeamId: identifierSchema,
    awayTeamId: identifierSchema,
    scheduledAt: z.iso.datetime({ offset: true }),
    startedAt: z.iso.datetime({ offset: true }).optional(),
    status: gameStatusSchema,
  })
  .strict()
  .refine((game) => game.homeTeamId !== game.awayTeamId, {
    path: ['awayTeamId'],
    message: 'home and away teams must be different',
  });

export type GameStatus = z.infer<typeof gameStatusSchema>;
export type Game = z.infer<typeof gameSchema>;
