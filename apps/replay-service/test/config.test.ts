import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/index.js';

describe('replay service config', () => {
  it('uses local defaults', () => {
    expect(loadConfig(['game.json'], {})).toEqual({
      fixturePath: 'game.json',
      ingestionApiUrl: 'http://localhost:3000',
      speed: 1,
    });
  });

  it('accepts command arguments and environment settings', () => {
    expect(
      loadConfig(['from-command.json', '50'], {
        FIXTURE_PATH: 'from-environment.json',
        INGESTION_API_URL: 'http://ingestion-api:3000',
        REPLAY_SPEED: '5',
      }),
    ).toEqual({
      fixturePath: 'from-command.json',
      ingestionApiUrl: 'http://ingestion-api:3000',
      speed: 50,
    });
    expect(
      loadConfig([], {
        FIXTURE_PATH: 'from-environment.json',
        REPLAY_SPEED: 'max',
      }),
    ).toEqual({
      fixturePath: 'from-environment.json',
      ingestionApiUrl: 'http://localhost:3000',
      speed: 'max',
    });
  });

  it('rejects missing or invalid settings', () => {
    expect(() => loadConfig([], {})).toThrow('fixture path is required');
    expect(() => loadConfig(['game.json', '2'], {})).toThrow(
      'replay speed must be',
    );
    expect(() =>
      loadConfig(['game.json'], { INGESTION_API_URL: 'redis://localhost' }),
    ).toThrow('must be a valid HTTP URL');
  });
});
