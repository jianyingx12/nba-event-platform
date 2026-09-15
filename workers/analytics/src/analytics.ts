import {
  gameEventSchema,
  gameSchema,
  type Game,
  type GameEvent,
} from '@nba-event-platform/schemas';

export interface TeamAnalytics {
  teamId: string;
  points: number;
  turnovers: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  fieldGoalPercentage: number;
  threePointersMade: number;
  threePointersAttempted: number;
  threePointPercentage: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  freeThrowPercentage: number;
}

export interface GameAnalytics {
  gameId: string;
  homeTeam: TeamAnalytics;
  awayTeam: TeamAnalytics;
  lastProcessedSequence: number;
}

export function createInitialGameAnalytics(game: Game): GameAnalytics {
  const value = gameSchema.parse(game);

  return {
    gameId: value.gameId,
    homeTeam: createInitialTeamAnalytics(value.homeTeamId),
    awayTeam: createInitialTeamAnalytics(value.awayTeamId),
    lastProcessedSequence: 0,
  };
}

export function applyAnalyticsEvent(
  analytics: GameAnalytics,
  event: GameEvent,
): GameAnalytics {
  const nextEvent = gameEventSchema.parse(event);

  if (nextEvent.gameId !== analytics.gameId) {
    throw new Error(`event ${nextEvent.eventId} belongs to a different game`);
  }

  if (nextEvent.sequence <= analytics.lastProcessedSequence) {
    throw new Error(
      `event ${nextEvent.eventId} sequence ${nextEvent.sequence} is not after ${analytics.lastProcessedSequence}`,
    );
  }

  const next: GameAnalytics = {
    ...analytics,
    homeTeam: { ...analytics.homeTeam },
    awayTeam: { ...analytics.awayTeam },
    lastProcessedSequence: nextEvent.sequence,
  };

  if (isTrackedEvent(nextEvent)) {
    const team = findTeam(next, nextEvent);
    applyTeamEvent(team, nextEvent);
    updatePercentages(team);
  }

  return next;
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
