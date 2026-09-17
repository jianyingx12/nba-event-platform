import type { Game, GameEvent } from '@nba-event-platform/schemas';

import type {
  BasketballEventSource,
  GameQuery,
  StreamOptions,
} from './event-source.js';
import { mapNbaPlayByPlay } from './nba-play-by-play.js';
import { mapNbaScoreboard } from './nba-scoreboard.js';

const SCOREBOARD_URL =
  'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json';
const PLAY_BY_PLAY_BASE_URL =
  'https://cdn.nba.com/static/json/liveData/playbyplay/';

export class NbaEventSource implements BasketballEventSource {
  constructor(private readonly request: typeof fetch = fetch) {}

  async listGames(options: GameQuery = {}): Promise<Game[]> {
    if (options.date !== undefined) {
      throw new Error(
        "NBA.com only provides today's games through this source",
      );
    }

    const payload = await this.fetchJson(SCOREBOARD_URL);
    return mapNbaScoreboard(payload);
  }

  async *streamGame(
    gameId: string,
    options: StreamOptions = {},
  ): AsyncIterable<GameEvent> {
    const url = new URL(
      `playbyplay_${encodeURIComponent(gameId)}.json`,
      PLAY_BY_PLAY_BASE_URL,
    );
    const payload = await this.fetchJson(url, options.signal);

    for (const event of mapNbaPlayByPlay(payload)) {
      yield event;
    }
  }

  private async fetchJson(
    url: string | URL,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const response = await this.request(url, {
      headers: { accept: 'application/json' },
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `NBA.com request failed with status ${response.status}: ${url}`,
      );
    }

    return response.json();
  }
}
