import { z } from 'zod';

import { basketballClockSchema, identifierSchema } from './common.js';

export const GAME_EVENT_TYPES = [
  'period_start',
  'period_end',
  'shot_made',
  'shot_missed',
  'free_throw_made',
  'free_throw_missed',
  'rebound',
  'assist',
  'turnover',
  'steal',
  'block',
  'foul',
  'substitution',
  'timeout',
  'game_end',
] as const;

export const gameEventTypeSchema = z.enum(GAME_EVENT_TYPES);

export const gameEventSchema = z
  .object({
    eventId: identifierSchema,
    gameId: identifierSchema,
    sequence: z
      .number()
      .int({ error: 'sequence must be a positive integer' })
      .positive({ error: 'sequence must be a positive integer' }),
    eventType: gameEventTypeSchema,
    occurredAt: z.iso.datetime({ offset: true }),
    period: z.number().int().positive(),
    clock: basketballClockSchema,
    teamId: identifierSchema.optional(),
    playerId: identifierSchema.optional(),
    secondaryPlayerId: identifierSchema.optional(),
    points: z.number().int().min(1).max(3).optional(),
    description: z.string().trim().min(1),
    source: identifierSchema,
    sourceEventId: identifierSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type GameEventType = z.infer<typeof gameEventTypeSchema>;
export type GameEvent = z.infer<typeof gameEventSchema>;
