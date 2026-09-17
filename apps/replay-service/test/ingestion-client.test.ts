import { describe, expect, it, vi } from 'vitest';

import { HttpEventIngestionClient } from '../src/index.js';

describe('HTTP ingestion client', () => {
  it('registers a game roster', async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({ accepted: true }),
    );
    const client = new HttpEventIngestionClient(
      'http://ingestion-api:3000',
      request,
    );
    const roster = {
      gameId: 'game-1',
      teams: [
        {
          teamId: 'BOS',
          abbreviation: 'BOS',
          city: 'Boston',
          name: 'Celtics',
        },
        {
          teamId: 'NYK',
          abbreviation: 'NYK',
          city: 'New York',
          name: 'Knicks',
        },
      ],
      players: [],
    };

    await expect(client.registerRoster(roster)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith(
      new URL('http://ingestion-api:3000/v1/rosters'),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(roster),
      },
    );
  });

  it('reports a rejected roster', async () => {
    const client = new HttpEventIngestionClient(
      'http://ingestion-api:3000',
      vi.fn<typeof fetch>(async () => new Response(null, { status: 503 })),
    );

    await expect(
      client.registerRoster({
        gameId: 'game-1',
        teams: [
          {
            teamId: 'BOS',
            abbreviation: 'BOS',
            city: 'Boston',
            name: 'Celtics',
          },
          {
            teamId: 'NYK',
            abbreviation: 'NYK',
            city: 'New York',
            name: 'Knicks',
          },
        ],
        players: [],
      }),
    ).rejects.toThrow('rejected roster for game-1 with status 503');
  });
});
