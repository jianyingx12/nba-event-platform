import type { GameWorkload } from './workload.js';
import type {
  LoadTestIngestionClient,
  RequestResult,
} from './ingestion-client.js';

export interface LoadTestReport {
  acceptedEvents: number;
  averageLatencyMs: number;
  duplicateEvents: number;
  durationMs: number;
  failedRequests: number;
  gamesRegistered: number;
  p95LatencyMs: number;
  requestsPerSecond: number;
  totalRequests: number;
}

interface RecordedRequest extends RequestResult {
  kind: 'event' | 'game';
}

export async function runLoadTest(
  workload: GameWorkload[],
  client: LoadTestIngestionClient,
  concurrency: number,
  now: () => number = performance.now.bind(performance),
): Promise<LoadTestReport> {
  const requests: RecordedRequest[] = [];
  const startedAt = now();

  await runWithConcurrency(workload, concurrency, async (item) => {
    const gameResult = await client.registerGame(item.game);
    requests.push({ ...gameResult, kind: 'game' });

    if (gameResult.outcome !== 'accepted') {
      return;
    }

    for (const event of item.events) {
      const eventResult = await client.publishEvent(event);
      requests.push({ ...eventResult, kind: 'event' });
    }
  });

  return summarizeRequests(requests, now() - startedAt);
}

export function summarizeRequests(
  requests: RecordedRequest[],
  durationMs: number,
): LoadTestReport {
  const latencies = requests
    .map((request) => request.latencyMs)
    .sort((left, right) => left - right);
  const totalLatency = latencies.reduce((total, latency) => total + latency, 0);

  return {
    acceptedEvents: requests.filter(
      (request) => request.kind === 'event' && request.outcome === 'accepted',
    ).length,
    averageLatencyMs: round(
      latencies.length === 0 ? 0 : totalLatency / latencies.length,
    ),
    duplicateEvents: requests.filter(
      (request) => request.kind === 'event' && request.outcome === 'duplicate',
    ).length,
    durationMs: round(durationMs),
    failedRequests: requests.filter((request) => request.outcome === 'failed')
      .length,
    gamesRegistered: requests.filter(
      (request) => request.kind === 'game' && request.outcome === 'accepted',
    ).length,
    p95LatencyMs: round(percentile(latencies, 0.95)),
    requestsPerSecond: round(
      durationMs <= 0 ? 0 : requests.length / (durationMs / 1_000),
    ),
    totalRequests: requests.length,
  };
}

async function runWithConcurrency<T>(
  values: T[],
  concurrency: number,
  operation: (value: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, values.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const value = values[nextIndex];
        nextIndex += 1;

        if (value !== undefined) {
          await operation(value);
        }
      }
    }),
  );
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const index = Math.max(0, Math.ceil(values.length * quantile) - 1);

  return values[index] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
