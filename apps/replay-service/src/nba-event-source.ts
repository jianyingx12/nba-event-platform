import type { Game, GameEvent } from '@nba-event-platform/schemas';

import type {
  BasketballEventSource,
  GameQuery,
  StreamOptions,
} from './event-source.js';
import { mapNbaBoxScore } from './nba-box-score.js';
import { mapNbaPlayByPlay } from './nba-play-by-play.js';
import { mapNbaScoreboard } from './nba-scoreboard.js';

const SCOREBOARD_URL =
  'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json';
const PLAY_BY_PLAY_BASE_URL =
  'https://cdn.nba.com/static/json/liveData/playbyplay/';
const BOX_SCORE_BASE_URL = 'https://cdn.nba.com/static/json/liveData/boxscore/';
const NBA_DATA_HOST = 'nba-prod-us-east-1-mediaops-stats.s3.amazonaws.com';

export class NbaEventSource implements BasketballEventSource {
  constructor(
    private readonly request: typeof fetch = fetch,
    private readonly wait: (milliseconds: number) => Promise<void> = delay,
  ) {}

  async listGames(options: GameQuery = {}): Promise<Game[]> {
    if (options.date !== undefined) {
      throw new Error(
        "NBA.com only provides today's games through this source",
      );
    }

    const payload = await this.fetchJson(SCOREBOARD_URL);
    return mapNbaScoreboard(payload);
  }

  async getGame(gameId: string, signal?: AbortSignal): Promise<Game> {
    const url = new URL(
      `boxscore_${encodeURIComponent(gameId)}.json`,
      BOX_SCORE_BASE_URL,
    );
    return mapNbaBoxScore(await this.fetchJson(url, signal));
  }

  async getGameEvents(
    gameId: string,
    signal?: AbortSignal,
  ): Promise<GameEvent[]> {
    const url = new URL(
      `playbyplay_${encodeURIComponent(gameId)}.json`,
      PLAY_BY_PLAY_BASE_URL,
    );
    return mapNbaPlayByPlay(await this.fetchJson(url, signal));
  }

  async *streamGame(
    gameId: string,
    options: StreamOptions = {},
  ): AsyncIterable<GameEvent> {
    const seenSourceEventIds = new Set<string>();
    let sequence = 0;

    while (!options.signal?.aborted) {
      let gameEnded = false;

      for (const event of await this.getGameEvents(gameId, options.signal)) {
        const sourceEventId = event.sourceEventId ?? event.eventId;
        if (seenSourceEventIds.has(sourceEventId)) continue;

        seenSourceEventIds.add(sourceEventId);
        sequence += 1;
        gameEnded ||= event.eventType === 'game_end';
        yield { ...event, sequence };
      }

      if (gameEnded) return;

      await this.wait(Math.max(0, options.pollIntervalMs ?? 5_000));
    }
  }

  private async fetchJson(
    url: string | URL,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const requestOptions: RequestInit = {
      headers: { accept: 'application/json' },
      signal,
    };
    let requestedUrl = url;
    let response = await this.request(requestedUrl, requestOptions);

    if (response.status === 403) {
      requestedUrl = createFallbackUrl(url);
      response = await this.request(requestedUrl, requestOptions);
    }

    if (!response.ok) {
      throw new Error(
        `NBA.com request failed with status ${response.status}: ${requestedUrl}`,
      );
    }

    return response.json();
  }
}

function createFallbackUrl(value: string | URL): URL {
  const url = new URL(value);
  url.hostname = NBA_DATA_HOST;
  url.pathname = url.pathname.replace('/static/json/', '/NBA/');
  return url;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
