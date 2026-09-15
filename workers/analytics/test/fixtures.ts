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
  eventType: 'shot_made',
  occurredAt: '2026-01-15T00:05:00.000Z',
  period: 1,
  clock: '11:43',
  teamId: game.homeTeamId,
  playerId: 'player-0',
  points: 3,
  description: 'BOS player makes a three-point shot',
  source: 'historical-replay',
} satisfies GameEvent;

export function createEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return { ...baseEvent, ...overrides };
}
