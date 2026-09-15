export interface BoxScoreWorkerConfig {
  batchSize: number;
  blockMs: number;
  consumerName: string;
  databaseUrl: string;
  redisUrl: string;
}

type Environment = Record<string, string | undefined>;

export function loadConfig(environment: Environment): BoxScoreWorkerConfig {
  return {
    batchSize: positiveInteger(environment.BATCH_SIZE, 'BATCH_SIZE', 10),
    blockMs: positiveInteger(environment.BLOCK_MS, 'BLOCK_MS', 5_000),
    consumerName: requiredValue(environment, 'CONSUMER_NAME'),
    databaseUrl: requiredValue(environment, 'DATABASE_URL'),
    redisUrl: requiredValue(environment, 'REDIS_URL'),
  };
}

function requiredValue(environment: Environment, name: string): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
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
