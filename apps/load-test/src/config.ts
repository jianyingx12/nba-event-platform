import { parseArgs } from 'node:util';

export interface LoadTestConfig {
  baseUrl: string;
  concurrency: number;
  eventsPerGame: number;
  games: number;
  runId: string;
}

type Environment = Record<string, string | undefined>;

export function loadConfig(
  args: string[],
  environment: Environment = process.env,
  now: Date = new Date(),
): LoadTestConfig {
  const { values } = parseArgs({
    args,
    options: {
      concurrency: { type: 'string' },
      'events-per-game': { type: 'string' },
      games: { type: 'string' },
      'run-id': { type: 'string' },
      url: { type: 'string' },
    },
    strict: true,
  });

  return {
    baseUrl: normalizeUrl(values.url ?? environment.INGESTION_API_URL),
    concurrency: positiveInteger(values.concurrency, 'concurrency', 10),
    eventsPerGame: positiveInteger(
      values['events-per-game'],
      'events-per-game',
      100,
    ),
    games: positiveInteger(values.games, 'games', 1),
    runId: nonEmpty(values['run-id'], 'run-id', createRunId(now)),
  };
}

function normalizeUrl(value: string | undefined): string {
  const url = new URL(value?.trim() || 'http://localhost:3000');

  return url.toString().replace(/\/$/, '');
}

function positiveInteger(
  value: string | undefined,
  name: string,
  defaultValue: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function nonEmpty(
  value: string | undefined,
  name: string,
  defaultValue: string,
): string {
  const parsed = value?.trim() || defaultValue;

  if (!parsed) {
    throw new Error(`${name} must not be empty`);
  }

  return parsed;
}

function createRunId(now: Date): string {
  return `load-${now.toISOString().replace(/[^0-9]/g, '')}`;
}
