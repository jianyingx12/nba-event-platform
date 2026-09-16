import { describe, expect, it } from 'vitest';

import {
  buildExpectedResults,
  createWorkload,
  verifyWorkload,
  type VerificationReader,
} from '../src/index.js';

describe('load test verification', () => {
  it('calculates expected state and player box scores without duplicates', () => {
    const [workload] = createWorkload({
      duplicateRate: 100,
      eventsPerGame: 6,
      games: 1,
      runId: 'verification-test',
      startedAt: '2026-09-16T06:00:00.000Z',
    });
    const expected = buildExpectedResults(workload!);

    expect(expected.state).toMatchObject({
      status: 'final',
      lastProcessedSequence: 6,
    });
    expect(expected.stats).toHaveLength(4);
    expect(
      expected.stats.reduce((total, stats) => total + stats.points, 0),
    ).toBe(6);
    expect(
      expected.stats.reduce((total, stats) => total + stats.rebounds, 0),
    ).toBe(1);
  });

  it('passes when stored results match expected results', async () => {
    const [workload] = createWorkload({
      eventsPerGame: 5,
      games: 1,
      runId: 'matching-test',
      startedAt: '2026-09-16T06:00:00.000Z',
    });
    const expected = buildExpectedResults(workload!);
    const reader: VerificationReader = {
      findGameState: async () => expected.state,
      listPlayerGameStats: async () => expected.stats,
    };

    const timestamps = [100, 125.678];

    await expect(
      verifyWorkload([workload!], reader, {
        now: () => timestamps.shift() ?? 0,
      }),
    ).resolves.toEqual({
      gamesVerified: 1,
      playerRowsVerified: expected.stats.length,
      processingWaitMs: 25.68,
      status: 'passed',
    });
  });

  it('fails when completed results do not match expectations', async () => {
    const [workload] = createWorkload({
      eventsPerGame: 5,
      games: 1,
      runId: 'mismatch-test',
      startedAt: '2026-09-16T06:00:00.000Z',
    });
    const expected = buildExpectedResults(workload!);
    const reader: VerificationReader = {
      findGameState: async () => ({
        ...expected.state,
        homeScore: expected.state.homeScore + 1,
      }),
      listPlayerGameStats: async () => expected.stats,
    };

    await expect(verifyWorkload([workload!], reader)).rejects.toThrow(
      `verification failed for ${workload!.game.gameId}`,
    );
  });
});
