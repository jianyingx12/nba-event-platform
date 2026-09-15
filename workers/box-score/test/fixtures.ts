import type { GameEvent } from '@nba-event-platform/schemas';

const baseEvent = {
  eventId: 'evt-1',
  gameId: 'bos-nyk-2026-01',
  sequence: 1,
  eventType: 'rebound',
  occurredAt: '2026-01-15T00:05:00.000Z',
  period: 1,
  clock: '11:43',
  teamId: 'BOS',
  playerId: 'player-0',
  description: 'BOS player records a rebound',
  source: 'historical-replay',
} satisfies GameEvent;

export function createEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return { ...baseEvent, ...overrides };
}
