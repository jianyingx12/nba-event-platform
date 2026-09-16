import { describe, expect, it, vi } from 'vitest';

import {
  createWorkload,
  runLoadTest,
  summarizeRequests,
  type LoadTestIngestionClient,
} from '../src/index.js';

describe('load test runner', () => {
  it('publishes events in sequence for each game', async () => {
    const workload = createWorkload({
      eventsPerGame: 3,
      games: 2,
      runId: 'runner-test',
      startedAt: '2026-09-16T06:00:00.000Z',
    });
    const sequences = new Map<string, number[]>();
    const client: LoadTestIngestionClient = {
      registerGame: vi.fn(async () => ({
        latencyMs: 2,
        outcome: 'accepted' as const,
      })),
      publishEvent: vi.fn(async (event) => {
        const gameSequences = sequences.get(event.gameId) ?? [];
        gameSequences.push(event.sequence);
        sequences.set(event.gameId, gameSequences);
        return { latencyMs: 3, outcome: 'accepted' as const };
      }),
    };
    const timestamps = [100, 1_100];

    const report = await runLoadTest(
      workload,
      client,
      2,
      () => timestamps.shift() ?? 0,
    );

    expect([...sequences.values()]).toEqual([
      [1, 2, 3],
      [1, 2, 3],
    ]);
    expect(report).toEqual({
      acceptedEvents: 6,
      averageLatencyMs: 2.75,
      duplicateEvents: 0,
      durationMs: 1_000,
      failedRequests: 0,
      gamesRegistered: 2,
      p95LatencyMs: 3,
      requestsPerSecond: 8,
      totalRequests: 8,
    });
  });

  it('summarizes failures, duplicates, and latency percentiles', () => {
    expect(
      summarizeRequests(
        [
          { kind: 'game', latencyMs: 5, outcome: 'accepted' },
          { kind: 'event', latencyMs: 10, outcome: 'accepted' },
          { kind: 'event', latencyMs: 20, outcome: 'duplicate' },
          { kind: 'event', latencyMs: 100, outcome: 'failed' },
        ],
        2_000,
      ),
    ).toEqual({
      acceptedEvents: 1,
      averageLatencyMs: 33.75,
      duplicateEvents: 1,
      durationMs: 2_000,
      failedRequests: 1,
      gamesRegistered: 1,
      p95LatencyMs: 100,
      requestsPerSecond: 2,
      totalRequests: 4,
    });
  });
});
