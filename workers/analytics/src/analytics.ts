import {
  gameAnalyticsSchema,
  gameEventSchema,
  gameSchema,
  type Game,
  type GameAnalytics,
  type GameEvent,
  type TeamAnalytics,
} from '@nba-event-platform/schemas';

export function createInitialGameAnalytics(game: Game): GameAnalytics {
  const value = gameSchema.parse(game);

  return gameAnalyticsSchema.parse({
    gameId: value.gameId,
    homeTeam: createInitialTeamAnalytics(value.homeTeamId),
    awayTeam: createInitialTeamAnalytics(value.awayTeamId),
    lastProcessedSequence: 0,
  });
}

export class EventSequenceGapError extends Error {
  constructor(eventId: string, sequence: number, expectedSequence: number) {
    super(
      `event ${eventId} sequence ${sequence} arrived before sequence ${expectedSequence}`,
    );
    this.name = 'EventSequenceGapError';
  }
}

export function applyAnalyticsEvent(
  analytics: GameAnalytics,
  event: GameEvent,
): GameAnalytics {
  const current = gameAnalyticsSchema.parse(analytics);
  const nextEvent = gameEventSchema.parse(event);

  if (nextEvent.gameId !== current.gameId) {
    throw new Error(`event ${nextEvent.eventId} belongs to a different game`);
  }

  if (nextEvent.sequence <= current.lastProcessedSequence) {
    throw new Error(
      `event ${nextEvent.eventId} sequence ${nextEvent.sequence} is not after ${current.lastProcessedSequence}`,
    );
  }

  const expectedSequence = current.lastProcessedSequence + 1;

  if (nextEvent.sequence !== expectedSequence) {
    throw new EventSequenceGapError(
      nextEvent.eventId,
      nextEvent.sequence,
      expectedSequence,
    );
  }

  const next: GameAnalytics = {
    ...current,
    homeTeam: { ...current.homeTeam },
    awayTeam: { ...current.awayTeam },
    lastProcessedSequence: nextEvent.sequence,
  };

  if (isTrackedEvent(nextEvent)) {
    const team = findTeam(next, nextEvent);
    applyTeamEvent(team, nextEvent);
    updatePercentages(team);
  }

  return gameAnalyticsSchema.parse(next);
}

function createInitialTeamAnalytics(teamId: string): TeamAnalytics {
  return {
    teamId,
    points: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    fieldGoalPercentage: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    threePointPercentage: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    freeThrowPercentage: 0,
  };
}

function isTrackedEvent(event: GameEvent): boolean {
  return (
    event.eventType === 'shot_made' ||
    event.eventType === 'shot_missed' ||
    event.eventType === 'free_throw_made' ||
    event.eventType === 'free_throw_missed' ||
    event.eventType === 'turnover'
  );
}

function findTeam(analytics: GameAnalytics, event: GameEvent): TeamAnalytics {
  if (event.teamId === analytics.homeTeam.teamId) {
    return analytics.homeTeam;
  }

  if (event.teamId === analytics.awayTeam.teamId) {
    return analytics.awayTeam;
  }

  throw new Error(`event ${event.eventId} is missing a known team`);
}

function applyTeamEvent(team: TeamAnalytics, event: GameEvent): void {
  switch (event.eventType) {
    case 'shot_made':
      applyMadeShot(team, event);
      break;
    case 'shot_missed':
      team.fieldGoalsAttempted += 1;
      if (event.points === 3) {
        team.threePointersAttempted += 1;
      }
      break;
    case 'free_throw_made':
      if (event.points !== 1) {
        throw new Error(`free throw ${event.eventId} must be worth one point`);
      }
      team.points += 1;
      team.freeThrowsMade += 1;
      team.freeThrowsAttempted += 1;
      break;
    case 'free_throw_missed':
      team.freeThrowsAttempted += 1;
      break;
    case 'turnover':
      team.turnovers += 1;
      break;
  }
}

function applyMadeShot(team: TeamAnalytics, event: GameEvent): void {
  if (event.points !== 2 && event.points !== 3) {
    throw new Error(
      `made shot ${event.eventId} must be worth two or three points`,
    );
  }

  team.points += event.points;
  team.fieldGoalsMade += 1;
  team.fieldGoalsAttempted += 1;

  if (event.points === 3) {
    team.threePointersMade += 1;
    team.threePointersAttempted += 1;
  }
}

function updatePercentages(team: TeamAnalytics): void {
  team.fieldGoalPercentage = percentage(
    team.fieldGoalsMade,
    team.fieldGoalsAttempted,
  );
  team.threePointPercentage = percentage(
    team.threePointersMade,
    team.threePointersAttempted,
  );
  team.freeThrowPercentage = percentage(
    team.freeThrowsMade,
    team.freeThrowsAttempted,
  );
}

function percentage(made: number, attempted: number): number {
  return attempted === 0 ? 0 : made / attempted;
}
