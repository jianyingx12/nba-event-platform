import type {
  Game,
  GameAnalytics,
  GameEvent,
  GameState,
  Player,
  PlayerGameStats,
  Team,
} from '../src/index.js';

export const homeTeam = {
  teamId: 'BOS',
  abbreviation: 'BOS',
  city: 'Boston',
  name: 'Celtics',
} satisfies Team;

export const awayTeam = {
  teamId: 'NYK',
  abbreviation: 'NYK',
  city: 'New York',
  name: 'Knicks',
} satisfies Team;

export const player = {
  playerId: 'player-0',
  displayName: 'Jayson Tatum',
  teamId: homeTeam.teamId,
} satisfies Player;

export const game = {
  gameId: 'bos-nyk-2026-01',
  homeTeamId: homeTeam.teamId,
  awayTeamId: awayTeam.teamId,
  scheduledAt: '2026-01-15T00:00:00.000Z',
  startedAt: '2026-01-15T00:05:00.000Z',
  status: 'live',
} satisfies Game;

export const gameState = {
  gameId: game.gameId,
  homeTeamId: homeTeam.teamId,
  awayTeamId: awayTeam.teamId,
  homeScore: 84,
  awayScore: 79,
  period: 3,
  clock: '4:28',
  status: 'live',
  lastProcessedSequence: 281,
} satisfies GameState;

export const playerGameStats = {
  playerId: player.playerId,
  gameId: game.gameId,
  lastProcessedSequence: 281,
  points: 28,
  rebounds: 8,
  assists: 6,
  steals: 2,
  blocks: 1,
  turnovers: 3,
  fieldGoalsMade: 10,
  fieldGoalsAttempted: 19,
  threePointersMade: 4,
  threePointersAttempted: 9,
  freeThrowsMade: 4,
  freeThrowsAttempted: 5,
} satisfies PlayerGameStats;

export const gameAnalytics = {
  gameId: game.gameId,
  homeTeam: {
    teamId: homeTeam.teamId,
    points: 84,
    turnovers: 9,
    fieldGoalsMade: 31,
    fieldGoalsAttempted: 67,
    fieldGoalPercentage: 31 / 67,
    threePointersMade: 12,
    threePointersAttempted: 29,
    threePointPercentage: 12 / 29,
    freeThrowsMade: 10,
    freeThrowsAttempted: 12,
    freeThrowPercentage: 10 / 12,
  },
  awayTeam: {
    teamId: awayTeam.teamId,
    points: 79,
    turnovers: 11,
    fieldGoalsMade: 29,
    fieldGoalsAttempted: 65,
    fieldGoalPercentage: 29 / 65,
    threePointersMade: 9,
    threePointersAttempted: 27,
    threePointPercentage: 9 / 27,
    freeThrowsMade: 12,
    freeThrowsAttempted: 15,
    freeThrowPercentage: 12 / 15,
  },
  lastProcessedSequence: 281,
} satisfies GameAnalytics;

export const validGameEvent = {
  eventId: 'evt-105',
  gameId: game.gameId,
  sequence: 105,
  eventType: 'shot_made',
  occurredAt: '2026-01-15T00:08:42.000Z',
  period: 3,
  clock: '8:42',
  teamId: homeTeam.teamId,
  playerId: player.playerId,
  points: 3,
  description: 'BOS player makes 3-point shot',
  source: 'historical-replay',
  sourceEventId: 'provider-event-105',
  metadata: {
    shotDistanceFeet: 25,
  },
} satisfies GameEvent;
