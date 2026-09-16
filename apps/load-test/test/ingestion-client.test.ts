import { describe, expect, it, vi } from 'vitest';

import { HttpLoadTestIngestionClient } from '../src/index.js';
import { createWorkload } from '../src/workload.js';

const { game, events } = createWorkload({
  eventsPerGame: 2,
  games: 1,
  runId: 'client-test',
  startedAt: '2026-09-16T06:00:00.000Z',
})[0]!;

describe('HTTP load test ingestion client', () => {
  it('classifies accepted and duplicate responses', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ accepted: true, gameId: game.gameId }),
      )
      .mockResolvedValueOnce(
        Response.json({ accepted: false, reason: 'duplicate_event' }),
      );
    const timestamps = [0, 5, 10, 18];
    const client = new HttpLoadTestIngestionClient(
      'http://localhost:3000',
      request,
      () => timestamps.shift() ?? 0,
    );

    await expect(client.registerGame(game)).resolves.toEqual({
      latencyMs: 5,
      outcome: 'accepted',
    });
    await expect(client.publishEvent(events[0]!)).resolves.toEqual({
      latencyMs: 8,
      outcome: 'duplicate',
    });
    expect(request).toHaveBeenCalledWith(
      'http://localhost:3000/v1/events',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(events[0]),
      }),
    );
  });

  it('classifies HTTP and network errors as failures', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockRejectedValueOnce(new Error('connection refused'));
    const timestamps = [0, 4, 10, 16];
    const client = new HttpLoadTestIngestionClient(
      'http://localhost:3000',
      request,
      () => timestamps.shift() ?? 0,
    );

    await expect(client.registerGame(game)).resolves.toEqual({
      latencyMs: 4,
      outcome: 'failed',
    });
    await expect(client.publishEvent(events[0]!)).resolves.toEqual({
      latencyMs: 6,
      outcome: 'failed',
    });
  });
});
