import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/index.js';

describe('box score worker configuration', () => {
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
      consumerName: 'worker-1',
      databaseUrl: 'postgresql://localhost/nba',
      redisUrl: 'redis://localhost:6379',
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
  });
});
