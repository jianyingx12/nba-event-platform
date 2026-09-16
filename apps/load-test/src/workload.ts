import {
  gameEventSchema,
  gameSchema,
  type Game,
  type GameEvent,
} from '@nba-event-platform/schemas';

export interface GameWorkload {
  game: Game;
  events: GameEvent[];
}

export interface WorkloadOptions {
  eventsPerGame: number;
  games: number;
  runId: string;
  startedAt?: string;
}

export function createWorkload(options: WorkloadOptions): GameWorkload[] {
  const startedAt = options.startedAt ?? new Date().toISOString();

  return Array.from({ length: options.games }, (_, gameIndex) =>
    createGameWorkload(
      options.runId,
      gameIndex + 1,
      options.eventsPerGame,
      startedAt,
    ),
  );
}

function createGameWorkload(
  runId: string,
  gameNumber: number,
  eventCount: number,
  startedAt: string,
): GameWorkload {
  const gameId = `${runId}-game-${gameNumber}`;
  const homeTeamId = `${runId}-home-${gameNumber}`;
  const awayTeamId = `${runId}-away-${gameNumber}`;
  const game = gameSchema.parse({
    gameId,
    homeTeamId,
    awayTeamId,
    scheduledAt: startedAt,
    startedAt,
    status: 'live',
  });

  return {
    game,
    events: Array.from({ length: eventCount }, (_, eventIndex) =>
      createEvent({
        awayTeamId,
        eventCount,
        gameId,
        homeTeamId,
        runId,
        sequence: eventIndex + 1,
        startedAt,
      }),
    ),
  };
}

interface EventOptions {
  awayTeamId: string;
  eventCount: number;
  gameId: string;
  homeTeamId: string;
  runId: string;
  sequence: number;
  startedAt: string;
}

function createEvent(options: EventOptions): GameEvent {
  const base = {
    eventId: `${options.runId}-event-${options.gameId}-${options.sequence}`,
    gameId: options.gameId,
    sequence: options.sequence,
    occurredAt: new Date(
      Date.parse(options.startedAt) + options.sequence * 1_000,
    ).toISOString(),
    period: 1,
    clock: '11:30',
    description: `Load test event ${options.sequence}`,
    source: 'load-test',
  };

  if (options.sequence === 1) {
    return gameEventSchema.parse({
      ...base,
      eventType: 'period_start',
      clock: '12:00',
    });
  }

  if (options.sequence === options.eventCount) {
    return gameEventSchema.parse({
      ...base,
      eventType: 'game_end',
      period: 4,
      clock: '0:00',
    });
  }

  const teamId =
    options.sequence % 2 === 0 ? options.homeTeamId : options.awayTeamId;
  const playerId = `${teamId}-player-${options.sequence % 10}`;

  if (options.sequence % 3 === 0) {
    return gameEventSchema.parse({
      ...base,
      eventType: 'rebound',
      teamId,
      playerId,
    });
  }

  return gameEventSchema.parse({
    ...base,
    eventType: 'shot_made',
    teamId,
    playerId,
    points: 2,
  });
}
