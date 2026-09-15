import type { Game, GameEvent } from '@nba-event-platform/schemas';

export const game = {
  gameId: 'bos-nyk-2026-01',
  homeTeamId: 'BOS',
  awayTeamId: 'NYK',
  scheduledAt: '2026-01-15T00:00:00.000Z',
  status: 'scheduled',
} satisfies Game;

const baseEvent = {
  eventId: 'evt-1',
  gameId: game.gameId,
  sequence: 1,
  eventType: 'period_start',
  occurredAt: '2026-01-15T00:05:00.000Z',
  period: 1,
  clock: '12:00',
  description: 'First period begins',
  source: 'historical-replay',
} satisfies GameEvent;

export function createEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return { ...baseEvent, ...overrides };
}
