import { gameEventSchema, gameSchema } from '@nba-event-platform/schemas';
import { describe, expect, it } from 'vitest';

import { createWorkload } from '../src/index.js';

describe('load test workload', () => {
  it('creates valid games and ordered events', () => {
    const workload = createWorkload({
      eventsPerGame: 5,
      games: 2,
      runId: 'test-run',
      startedAt: '2026-09-16T06:00:00.000Z',
    });

    expect(workload).toHaveLength(2);

    for (const item of workload) {
      expect(gameSchema.safeParse(item.game).success).toBe(true);
      expect(item.events).toHaveLength(5);
      expect(item.events.map((event) => event.sequence)).toEqual([
        1, 2, 3, 4, 5,
      ]);
      expect(item.events[0]?.eventType).toBe('period_start');
      expect(item.events[4]?.eventType).toBe('game_end');
      expect(
        item.events.every(
          (event) =>
            event.gameId === item.game.gameId &&
            gameEventSchema.safeParse(event).success,
        ),
      ).toBe(true);
    }
  });

  it('uses unique game and event identifiers', () => {
    const workload = createWorkload({
      eventsPerGame: 3,
      games: 3,
      runId: 'unique-run',
      startedAt: '2026-09-16T06:00:00.000Z',
    });
    const gameIds = workload.map((item) => item.game.gameId);
    const eventIds = workload.flatMap((item) =>
      item.events.map((event) => event.eventId),
    );

    expect(new Set(gameIds).size).toBe(gameIds.length);
    expect(new Set(eventIds).size).toBe(eventIds.length);
  });
});
