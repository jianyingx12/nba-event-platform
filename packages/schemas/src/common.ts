import { z } from 'zod';

export const identifierSchema = z.string().trim().min(1);

export const nonNegativeIntegerSchema = z.number().int().nonnegative();

export const basketballClockSchema = z
  .string()
  .regex(
    /^(?:[0-9]|1[0-2]):[0-5][0-9](?:\.[0-9])?$/,
    'clock must use M:SS, MM:SS, or MM:SS.t format',
  );
