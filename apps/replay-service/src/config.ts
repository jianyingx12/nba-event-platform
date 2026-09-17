import { parseReplaySpeed, type ReplaySpeed } from './replay.js';

interface SharedConfig {
  ingestionApiUrl: string;
}

export interface FixtureReplayConfig extends SharedConfig {
  source: 'fixture';
  fixturePath: string;
  speed: ReplaySpeed;
}

export interface NbaReplayConfig extends SharedConfig {
  source: 'nba';
  gameId: string;
}

export interface NbaHistoricalReplayConfig extends SharedConfig {
  source: 'nba-history';
  gameId: string;
}

export type ReplayServiceConfig =
  FixtureReplayConfig | NbaReplayConfig | NbaHistoricalReplayConfig;

type Environment = Record<string, string | undefined>;

export function loadConfig(
  arguments_: readonly string[],
  environment: Environment,
): ReplayServiceConfig {
  const ingestionApiUrl =
    environment.INGESTION_API_URL?.trim() || 'http://localhost:3000';
  validateHttpUrl(ingestionApiUrl);

  if (arguments_[0] === '--nba') {
    const gameId = arguments_[1]?.trim();
    if (!gameId) throw new Error('NBA game id is required after --nba');

    return { source: 'nba', gameId, ingestionApiUrl };
  }

  if (arguments_[0] === '--nba-history') {
    const gameId = arguments_[1]?.trim();
    if (!gameId) {
      throw new Error('NBA game id is required after --nba-history');
    }

    return { source: 'nba-history', gameId, ingestionApiUrl };
  }

  const fixturePath = arguments_[0]?.trim() || environment.FIXTURE_PATH?.trim();
  if (!fixturePath) throw new Error('fixture path is required');

  return {
    source: 'fixture',
    fixturePath,
    ingestionApiUrl,
    speed: parseReplaySpeed(
      arguments_[1]?.trim() || environment.REPLAY_SPEED?.trim() || '1',
    ),
  };
}

function validateHttpUrl(value: string): void {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('INGESTION_API_URL must be a valid HTTP URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('INGESTION_API_URL must be a valid HTTP URL');
  }
}
