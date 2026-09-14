import type { GameEvent } from '../src/index.js';

export const validGameEvent = {
  eventId: 'evt-105',
  gameId: 'bos-nyk-2026-01',
  sequence: 105,
  eventType: 'shot_made',
  occurredAt: '2026-01-15T00:08:42.000Z',
  period: 3,
  clock: '8:42',
  teamId: 'BOS',
  playerId: 'player-0',
  points: 3,
  description: 'BOS player makes 3-point shot',
  source: 'historical-replay',
  sourceEventId: 'provider-event-105',
  metadata: {
    shotDistanceFeet: 25,
  },
} satisfies GameEvent;
