import { z } from 'zod';

import { identifierSchema } from './common.js';

export const playerSchema = z
  .object({
    playerId: identifierSchema,
    displayName: z.string().trim().min(1),
    teamId: identifierSchema.optional(),
  })
  .strict();

export type Player = z.infer<typeof playerSchema>;
