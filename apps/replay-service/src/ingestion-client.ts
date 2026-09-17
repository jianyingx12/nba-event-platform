import type { Game, GameEvent, GameRoster } from '@nba-event-platform/schemas';

import type { EventIngestionClient } from './replay.js';

export class HttpEventIngestionClient implements EventIngestionClient {
  private readonly eventsEndpoint: URL;
  private readonly gamesEndpoint: URL;
  private readonly rostersEndpoint: URL;

  constructor(
    baseUrl: string,
    private readonly request: typeof fetch = fetch,
  ) {
    this.eventsEndpoint = new URL('/v1/events', baseUrl);
    this.gamesEndpoint = new URL('/v1/games', baseUrl);
    this.rostersEndpoint = new URL('/v1/rosters', baseUrl);
  }

  async registerRoster(roster: GameRoster): Promise<void> {
    const response = await this.request(this.rostersEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(roster),
    });

    if (!response.ok) {
      throw new Error(
        `ingestion API rejected roster for ${roster.gameId} with status ${response.status}`,
      );
    }
  }

  async registerGame(game: Game): Promise<void> {
    const response = await this.request(this.gamesEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(game),
    });

    if (!response.ok) {
      throw new Error(
        `ingestion API rejected game ${game.gameId} with status ${response.status}`,
      );
    }
  }

  async submit(event: GameEvent): Promise<void> {
    const response = await this.request(this.eventsEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(
        `ingestion API rejected event ${event.eventId} with status ${response.status}`,
      );
    }
  }
}
