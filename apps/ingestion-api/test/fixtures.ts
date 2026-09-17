import type { Game, GameEvent, GameRoster } from '@nba-event-platform/schemas';

export const game = {
  gameId: 'bos-nyk-2026-01',
  homeTeamId: 'BOS',
  awayTeamId: 'NYK',
  scheduledAt: '2026-01-15T00:00:00.000Z',
  startedAt: '2026-01-15T00:05:00.000Z',
  status: 'live',
} satisfies Game;

export const gameEvent = {
  eventId: 'evt-105',
  gameId: game.gameId,
  sequence: 105,
  eventType: 'shot_made',
  occurredAt: '2026-01-15T00:08:42.000Z',
  period: 3,
  clock: '8:42',
  teamId: game.homeTeamId,
  playerId: 'player-0',
  points: 3,
  description: 'BOS player makes 3-point shot',
  source: 'historical-replay',
} satisfies GameEvent;

export const gameRoster = {
  gameId: game.gameId,
  teams: [
    {
      teamId: game.homeTeamId,
      abbreviation: 'BOS',
      city: 'Boston',
      name: 'Celtics',
    },
    {
      teamId: game.awayTeamId,
      abbreviation: 'NYK',
      city: 'New York',
      name: 'Knicks',
    },
  ],
  players: [
    {
      playerId: 'player-0',
      displayName: 'Example Player',
      teamId: game.homeTeamId,
    },
  ],
} satisfies GameRoster;
