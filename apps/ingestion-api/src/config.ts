export interface IngestionApiConfig {
  databaseUrl: string;
  host: string;
  port: number;
  redisUrl: string;
}

type Environment = Record<string, string | undefined>;

export function loadConfig(environment: Environment): IngestionApiConfig {
  return {
    databaseUrl: requiredValue(environment, 'DATABASE_URL'),
    host: environment.HOST ?? '0.0.0.0',
    port: parsePort(environment.PORT),
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

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return 3000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}
