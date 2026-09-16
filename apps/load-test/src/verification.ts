import type {
  GameEvent,
  GameState,
  PlayerGameStats,
} from '@nba-event-platform/schemas';
import { isDeepStrictEqual } from 'node:util';

import type { GameWorkload } from './workload.js';

export interface VerificationReader {
  findGameState(gameId: string): Promise<GameState | null>;
  listPlayerGameStats(gameId: string): Promise<PlayerGameStats[]>;
}

export interface ExpectedGameResults {
  state: GameState;
  stats: PlayerGameStats[];
}

export interface VerificationReport {
  gamesVerified: number;
  playerRowsVerified: number;
  processingWaitMs: number;
  status: 'passed';
}

export interface VerificationOptions {
  now?: () => number;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export async function verifyWorkload(
  workload: GameWorkload[],
  reader: VerificationReader,
  options: VerificationOptions = {},
): Promise<VerificationReport> {
  const expected = workload.map(buildExpectedResults);
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollIntervalMs = options.pollIntervalMs ?? 100;
  const now = options.now ?? performance.now.bind(performance);
  const startedAt = now();
  const deadline = startedAt + timeoutMs;

  while (true) {
    const actual = await Promise.all(
      workload.map(async ({ game }) => ({
        state: await reader.findGameState(game.gameId),
        stats: await reader.listPlayerGameStats(game.gameId),
      })),
    );

    if (isComplete(expected, actual)) {
      assertMatches(expected, actual);

      return {
        gamesVerified: expected.length,
        playerRowsVerified: expected.reduce(
          (total, game) => total + game.stats.length,
          0,
        ),
        processingWaitMs: round(now() - startedAt),
        status: 'passed',
      };
    }

    if (now() >= deadline) {
      throw new Error(`verification timed out after ${timeoutMs}ms`);
    }

    await delay(pollIntervalMs);
  }
}

export function buildExpectedResults(
  workload: GameWorkload,
): ExpectedGameResults {
  const events = uniqueEvents(workload.events);
  const state: GameState = {
    gameId: workload.game.gameId,
    homeTeamId: workload.game.homeTeamId,
    awayTeamId: workload.game.awayTeamId,
    homeScore: 0,
    awayScore: 0,
    period: 0,
    clock: '12:00',
    status: workload.game.status,
    lastProcessedSequence: 0,
  };
  const stats = new Map<string, PlayerGameStats>();

  for (const event of events) {
    applyStateEvent(state, event);
    applyStatsEvent(stats, event);
  }

  return {
    state,
    stats: [...stats.values()].sort((left, right) =>
      left.playerId.localeCompare(right.playerId),
    ),
  };
}

function uniqueEvents(events: GameEvent[]): GameEvent[] {
  return [
    ...new Map(events.map((event) => [event.eventId, event])).values(),
  ].sort((left, right) => left.sequence - right.sequence);
}

function applyStateEvent(state: GameState, event: GameEvent): void {
  state.period = event.period;
  state.clock = event.clock;
  state.lastProcessedSequence = event.sequence;

  if (
    (event.eventType === 'shot_made' ||
      event.eventType === 'free_throw_made') &&
    event.points !== undefined
  ) {
    if (event.teamId === state.homeTeamId) {
      state.homeScore += event.points;
    } else if (event.teamId === state.awayTeamId) {
      state.awayScore += event.points;
    }
  }

  if (event.eventType === 'period_start') {
    state.status = 'live';
  } else if (event.eventType === 'game_end') {
    state.status = 'final';
  }
}

function applyStatsEvent(
  stats: Map<string, PlayerGameStats>,
  event: GameEvent,
): void {
  if (event.playerId === undefined) {
    return;
  }

  const current = stats.get(event.playerId) ?? emptyStats(event);

  if (event.eventType === 'shot_made' && event.points !== undefined) {
    current.points += event.points;
    current.fieldGoalsMade += 1;
    current.fieldGoalsAttempted += 1;

    if (event.points === 3) {
      current.threePointersMade += 1;
      current.threePointersAttempted += 1;
    }
  } else if (event.eventType === 'rebound') {
    current.rebounds += 1;
  }

  current.lastProcessedSequence = event.sequence;
  stats.set(event.playerId, current);
}

function emptyStats(event: GameEvent): PlayerGameStats {
  return {
    gameId: event.gameId,
    playerId: event.playerId!,
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
  };
}

function isComplete(
  expected: ExpectedGameResults[],
  actual: Array<{ state: GameState | null; stats: PlayerGameStats[] }>,
): boolean {
  return expected.every((game, index) => {
    const value = actual[index];

    return (
      value?.state?.lastProcessedSequence ===
        game.state.lastProcessedSequence &&
      value.stats.length === game.stats.length &&
      value.stats.every(
        (stats, statsIndex) =>
          stats.lastProcessedSequence ===
          game.stats[statsIndex]?.lastProcessedSequence,
      )
    );
  });
}

function assertMatches(
  expected: ExpectedGameResults[],
  actual: Array<{ state: GameState | null; stats: PlayerGameStats[] }>,
): void {
  for (const [index, game] of expected.entries()) {
    const value = actual[index];
    const sortedStats = [...(value?.stats ?? [])].sort((left, right) =>
      left.playerId.localeCompare(right.playerId),
    );

    if (
      !isDeepStrictEqual(value?.state, game.state) ||
      !isDeepStrictEqual(sortedStats, game.stats)
    ) {
      throw new Error(`verification failed for ${game.state.gameId}`);
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
