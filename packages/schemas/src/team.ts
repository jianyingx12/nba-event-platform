import { z } from 'zod';

import { identifierSchema } from './common.js';

export const teamSchema = z
  .object({
    teamId: identifierSchema,
    abbreviation: z.string().regex(/^[A-Z]{2,4}$/),
    city: z.string().trim().min(1),
    name: z.string().trim().min(1),
  })
  .strict();

export type Team = z.infer<typeof teamSchema>;
