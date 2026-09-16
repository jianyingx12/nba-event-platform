import type { Game, GameEvent } from '@nba-event-platform/schemas';

export interface GameQuery {
  date?: string;
}

export interface StreamOptions {
  signal?: AbortSignal;
}

export interface BasketballEventSource {
  listGames(options?: GameQuery): Promise<Game[]>;
  streamGame(gameId: string, options?: StreamOptions): AsyncIterable<GameEvent>;
}
