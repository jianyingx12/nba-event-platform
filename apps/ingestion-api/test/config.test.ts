import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/index.js';

describe('ingestion API configuration', () => {
  it('loads required connections and server defaults', () => {
    expect(
      loadConfig({
        DATABASE_URL: 'postgresql://localhost/nba',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toEqual({
      databaseUrl: 'postgresql://localhost/nba',
      host: '0.0.0.0',
      port: 3000,
      redisUrl: 'redis://localhost:6379',
    });
  });

  it('requires database and Redis connection URLs', () => {
    expect(() => loadConfig({ REDIS_URL: 'redis://localhost' })).toThrow(
      'DATABASE_URL is required',
    );
    expect(() =>
      loadConfig({ DATABASE_URL: 'postgresql://localhost' }),
    ).toThrow('REDIS_URL is required');
  });

  it('rejects an invalid port', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgresql://localhost/nba',
        PORT: '70000',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toThrow('PORT must be an integer between 1 and 65535');
  });
});
