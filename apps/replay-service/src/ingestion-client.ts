import type { GameEvent } from '@nba-event-platform/schemas';

import type { EventIngestionClient } from './replay.js';

export class HttpEventIngestionClient implements EventIngestionClient {
  private readonly endpoint: URL;

  constructor(
    baseUrl: string,
    private readonly request: typeof fetch = fetch,
  ) {
    this.endpoint = new URL('/v1/events', baseUrl);
  }

  async submit(event: GameEvent): Promise<void> {
    const response = await this.request(this.endpoint, {
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
