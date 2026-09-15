import {
  gameEventSchema,
  gameSchema,
  gameStateSchema,
  type Game,
  type GameEvent,
  type GameState,
} from '@nba-event-platform/schemas';

export function createInitialGameState(game: Game): GameState {
  const value = gameSchema.parse(game);

  return gameStateSchema.parse({
    gameId: value.gameId,
    homeTeamId: value.homeTeamId,
    awayTeamId: value.awayTeamId,
    homeScore: 0,
    awayScore: 0,
    period: 0,
    clock: '12:00',
    status: value.status,
    lastProcessedSequence: 0,
  });
}

export function applyGameEvent(state: GameState, event: GameEvent): GameState {
  const current = gameStateSchema.parse(state);
  const nextEvent = gameEventSchema.parse(event);

  if (nextEvent.gameId !== current.gameId) {
    throw new Error(`event ${nextEvent.eventId} belongs to a different game`);
  }

  const next: GameState = {
    ...current,
    period: nextEvent.period,
    clock: nextEvent.clock,
    lastProcessedSequence: nextEvent.sequence,
  };

  if (
    nextEvent.eventType === 'shot_made' ||
    nextEvent.eventType === 'free_throw_made'
  ) {
    applyPoints(next, nextEvent);
  }

  if (nextEvent.eventType === 'period_start') {
    next.status = 'live';
  } else if (nextEvent.eventType === 'game_end') {
    next.status = 'final';
  }

  return gameStateSchema.parse(next);
}

function applyPoints(state: GameState, event: GameEvent): void {
  if (event.points === undefined || event.teamId === undefined) {
    throw new Error(`scoring event ${event.eventId} is missing team or points`);
  }

  if (event.teamId === state.homeTeamId) {
    state.homeScore += event.points;
  } else if (event.teamId === state.awayTeamId) {
    state.awayScore += event.points;
  } else {
    throw new Error(`scoring event ${event.eventId} has an unknown team`);
  }
}
