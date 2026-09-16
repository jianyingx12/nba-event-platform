import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/index.js';

describe('load test configuration', () => {
  it('loads defaults', () => {
    expect(loadConfig([], {}, new Date('2026-09-16T06:00:00.000Z'))).toEqual({
      baseUrl: 'http://localhost:3000',
      concurrency: 10,
      duplicateRate: 0,
      eventsPerGame: 100,
      games: 1,
      runId: 'load-20260916060000000',
    });
  });

  it('loads command-line values', () => {
    expect(
      loadConfig([
        '--url',
        'http://ingestion-api:3000/',
        '--games',
        '16',
        '--events-per-game',
        '1000',
        '--duplicate-rate',
        '12.5',
        '--concurrency',
        '20',
        '--run-id',
        'benchmark-1',
      ]),
    ).toEqual({
      baseUrl: 'http://ingestion-api:3000',
      concurrency: 20,
      duplicateRate: 12.5,
      eventsPerGame: 1_000,
      games: 16,
      runId: 'benchmark-1',
    });
  });

  it('rejects invalid numeric values', () => {
    expect(() => loadConfig(['--games', '0'])).toThrow(
      'games must be a positive integer',
    );
    expect(() => loadConfig(['--events-per-game', 'many'])).toThrow(
      'events-per-game must be a positive integer',
    );
    expect(() => loadConfig(['--concurrency=-1'])).toThrow(
      'concurrency must be a positive integer',
    );
    expect(() => loadConfig(['--duplicate-rate=-1'])).toThrow(
      'duplicate-rate must be a number between 0 and 100',
    );
    expect(() => loadConfig(['--duplicate-rate', '101'])).toThrow(
      'duplicate-rate must be a number between 0 and 100',
    );
  });
});
