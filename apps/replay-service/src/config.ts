import { parseReplaySpeed, type ReplaySpeed } from './replay.js';

export interface ReplayServiceConfig {
  fixturePath: string;
  ingestionApiUrl: string;
  speed: ReplaySpeed;
}

type Environment = Record<string, string | undefined>;

export function loadConfig(
  arguments_: readonly string[],
  environment: Environment,
): ReplayServiceConfig {
  const fixturePath = arguments_[0]?.trim() || environment.FIXTURE_PATH?.trim();

  if (!fixturePath) {
    throw new Error('fixture path is required');
  }

  const ingestionApiUrl =
    environment.INGESTION_API_URL?.trim() || 'http://localhost:3000';
  validateHttpUrl(ingestionApiUrl);

  return {
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
