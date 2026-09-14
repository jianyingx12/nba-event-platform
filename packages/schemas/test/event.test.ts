import { describe, expect, it } from 'vitest';

import { gameEventSchema } from '../src/index.js';
import { validGameEvent } from './fixtures.js';

describe('gameEventSchema', () => {
  it('parses a canonical game event', () => {
    expect(gameEventSchema.parse(validGameEvent)).toEqual(validGameEvent);
  });

  it('rejects a non-positive sequence with a stable message', () => {
    const result = gameEventSchema.safeParse({
      ...validGameEvent,
      sequence: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['sequence'],
          message: 'sequence must be a positive integer',
        }),
      );
    }
  });

  it.each([
    ['unknown event type', { eventType: 'dunk' }],
    ['malformed clock', { clock: '8 minutes' }],
    ['unknown field', { unexpected: true }],
  ])('rejects an %s', (_name, change) => {
    expect(
      gameEventSchema.safeParse({ ...validGameEvent, ...change }).success,
    ).toBe(false);
  });
});
