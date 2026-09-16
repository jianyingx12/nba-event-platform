import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/index.js';

describe('game state worker configuration', () => {
  it('loads required values and processing defaults', () => {
    expect(
      loadConfig({
        CONSUMER_NAME: 'worker-1',
        DATABASE_URL: 'postgresql://localhost/nba',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toEqual({
      batchSize: 10,
      blockMs: 5_000,
      claimIdleMs: 30_000,
      consumerName: 'worker-1',
      databaseUrl: 'postgresql://localhost/nba',
      healthHost: '0.0.0.0',
      healthPort: 3_000,
      maxAttempts: 3,
      redisUrl: 'redis://localhost:6379',
      retryDelayMs: 1_000,
    });
  });

  it('requires a consumer name and connection URLs', () => {
    expect(() => loadConfig({})).toThrow('CONSUMER_NAME is required');
    expect(() => loadConfig({ CONSUMER_NAME: 'worker-1' })).toThrow(
      'DATABASE_URL is required',
    );
    expect(() =>
      loadConfig({
        CONSUMER_NAME: 'worker-1',
        DATABASE_URL: 'postgresql://localhost/nba',
      }),
    ).toThrow('REDIS_URL is required');
  });

  it('rejects invalid batch and blocking settings', () => {
    const environment = {
      CONSUMER_NAME: 'worker-1',
      DATABASE_URL: 'postgresql://localhost/nba',
      REDIS_URL: 'redis://localhost:6379',
    };

    expect(() => loadConfig({ ...environment, BATCH_SIZE: '0' })).toThrow(
      'BATCH_SIZE must be a positive integer',
    );
    expect(() => loadConfig({ ...environment, BLOCK_MS: 'later' })).toThrow(
      'BLOCK_MS must be a positive integer',
    );
    expect(() => loadConfig({ ...environment, CLAIM_IDLE_MS: '0' })).toThrow(
      'CLAIM_IDLE_MS must be a positive integer',
    );
    expect(() => loadConfig({ ...environment, MAX_ATTEMPTS: '0' })).toThrow(
      'MAX_ATTEMPTS must be a positive integer',
    );
    expect(() => loadConfig({ ...environment, RETRY_DELAY_MS: '-1' })).toThrow(
      'RETRY_DELAY_MS must be a positive integer',
    );
    expect(() => loadConfig({ ...environment, HEALTH_PORT: '0' })).toThrow(
      'HEALTH_PORT must be an integer between 1 and 65535',
    );
    expect(() => loadConfig({ ...environment, HEALTH_PORT: '65536' })).toThrow(
      'HEALTH_PORT must be an integer between 1 and 65535',
    );
  });
});
