import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/index.js';

describe('replay service config', () => {
  it('uses local defaults', () => {
    expect(loadConfig(['game.json'], {})).toEqual({
      source: 'fixture',
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
      source: 'fixture',
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
      source: 'fixture',
      fixturePath: 'from-environment.json',
      ingestionApiUrl: 'http://localhost:3000',
      speed: 'max',
    });
  });

  it('selects an NBA.com game from the command line', () => {
    expect(loadConfig(['--nba', '0022500001'], {})).toEqual({
      source: 'nba',
      gameId: '0022500001',
      ingestionApiUrl: 'http://localhost:3000',
    });
    expect(() => loadConfig(['--nba'], {})).toThrow('NBA game id is required');
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
