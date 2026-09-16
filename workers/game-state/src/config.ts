export interface GameStateWorkerConfig {
  batchSize: number;
  blockMs: number;
  claimIdleMs: number;
  consumerName: string;
  databaseUrl: string;
  healthHost: string;
  healthPort: number;
  maxAttempts: number;
  redisUrl: string;
  retryDelayMs: number;
}

type Environment = Record<string, string | undefined>;

export function loadConfig(environment: Environment): GameStateWorkerConfig {
  return {
    batchSize: positiveInteger(environment.BATCH_SIZE, 'BATCH_SIZE', 10),
    blockMs: positiveInteger(environment.BLOCK_MS, 'BLOCK_MS', 5_000),
    claimIdleMs: positiveInteger(
      environment.CLAIM_IDLE_MS,
      'CLAIM_IDLE_MS',
      30_000,
    ),
    consumerName: requiredValue(environment, 'CONSUMER_NAME'),
    databaseUrl: requiredValue(environment, 'DATABASE_URL'),
    healthHost: environment.HEALTH_HOST?.trim() || '0.0.0.0',
    healthPort: port(environment.HEALTH_PORT, 'HEALTH_PORT', 3_000),
    maxAttempts: positiveInteger(environment.MAX_ATTEMPTS, 'MAX_ATTEMPTS', 3),
    redisUrl: requiredValue(environment, 'REDIS_URL'),
    retryDelayMs: positiveInteger(
      environment.RETRY_DELAY_MS,
      'RETRY_DELAY_MS',
      1_000,
    ),
  };
}

function requiredValue(environment: Environment, name: string): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function port(
  value: string | undefined,
  name: string,
  defaultValue: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }

  return parsed;
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
