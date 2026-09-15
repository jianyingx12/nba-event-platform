import {
  gameEventSchema,
  playerGameStatsSchema,
  type GameEvent,
  type PlayerGameStats,
} from '@nba-event-platform/schemas';

export function createInitialPlayerGameStats(
  gameId: string,
  playerId: string,
): PlayerGameStats {
  return playerGameStatsSchema.parse({
    gameId,
    playerId,
    lastProcessedSequence: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
  });
}

export function applyPlayerGameEvent(
  stats: PlayerGameStats,
  event: GameEvent,
): PlayerGameStats {
  const current = playerGameStatsSchema.parse(stats);
  const nextEvent = gameEventSchema.parse(event);

  if (nextEvent.gameId !== current.gameId) {
    throw new Error(`event ${nextEvent.eventId} belongs to a different game`);
  }

  if (nextEvent.playerId !== current.playerId) {
    throw new Error(`event ${nextEvent.eventId} belongs to a different player`);
  }

  if (nextEvent.sequence <= current.lastProcessedSequence) {
    throw new Error(
      `event ${nextEvent.eventId} sequence ${nextEvent.sequence} is not after ${current.lastProcessedSequence}`,
    );
  }

  const next = { ...current };

  switch (nextEvent.eventType) {
    case 'shot_made':
      applyMadeShot(next, nextEvent);
      break;
    case 'shot_missed':
      next.fieldGoalsAttempted += 1;
      if (nextEvent.points === 3) {
        next.threePointersAttempted += 1;
      }
      break;
    case 'free_throw_made':
      if (nextEvent.points !== 1) {
        throw new Error(
          `free throw ${nextEvent.eventId} must be worth one point`,
        );
      }
      next.points += 1;
      next.freeThrowsMade += 1;
      next.freeThrowsAttempted += 1;
      break;
    case 'free_throw_missed':
      next.freeThrowsAttempted += 1;
      break;
    case 'rebound':
      next.rebounds += 1;
      break;
    case 'assist':
      next.assists += 1;
      break;
    case 'steal':
      next.steals += 1;
      break;
    case 'block':
      next.blocks += 1;
      break;
    case 'turnover':
      next.turnovers += 1;
      break;
    default:
      break;
  }

  next.lastProcessedSequence = nextEvent.sequence;

  return playerGameStatsSchema.parse(next);
}

function applyMadeShot(stats: PlayerGameStats, event: GameEvent): void {
  if (event.points !== 2 && event.points !== 3) {
    throw new Error(
      `made shot ${event.eventId} must be worth two or three points`,
    );
  }

  stats.points += event.points;
  stats.fieldGoalsMade += 1;
  stats.fieldGoalsAttempted += 1;

  if (event.points === 3) {
    stats.threePointersMade += 1;
    stats.threePointersAttempted += 1;
  }
}
