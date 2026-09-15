import type { GameEvent } from '@nba-event-platform/schemas';
import { describe, expect, it, vi } from 'vitest';

import {
  HttpEventIngestionClient,
  parseReplaySpeed,
  replayFixture,
  type EventIngestionClient,
  type ReplayFixture,
} from '../src/index.js';

const events = [
  createEvent(1, '2026-01-15T00:00:00.000Z'),
  createEvent(2, '2026-01-15T00:00:05.000Z'),
  createEvent(3, '2026-01-15T00:00:15.000Z'),
];
const fixture = {
  game: {
    gameId: 'replay-game-1',
    homeTeamId: 'BOS',
    awayTeamId: 'NYK',
    scheduledAt: '2026-01-15T00:00:00.000Z',
    status: 'final',
  },
  events,
} satisfies ReplayFixture;

describe('replay runner', () => {
  it('submits events in order using the selected speed', async () => {
    const ingestion = createIngestionClient();
    const wait = vi.fn(async () => undefined);

    await expect(
      replayFixture(fixture, ingestion, { speed: 5, wait }),
    ).resolves.toBe(3);

    expect(wait).toHaveBeenNthCalledWith(1, 1_000);
    expect(wait).toHaveBeenNthCalledWith(2, 2_000);
    expect(ingestion.submit).toHaveBeenNthCalledWith(1, events[0]);
    expect(ingestion.submit).toHaveBeenNthCalledWith(2, events[1]);
    expect(ingestion.submit).toHaveBeenNthCalledWith(3, events[2]);
  });

  it('does not wait at maximum speed', async () => {
    const ingestion = createIngestionClient();
    const wait = vi.fn(async () => undefined);

    await replayFixture(fixture, ingestion, { speed: 'max', wait });

    expect(wait).not.toHaveBeenCalled();
    expect(ingestion.submit).toHaveBeenCalledTimes(3);
  });

  it('accepts only supported speed values', () => {
    expect(parseReplaySpeed('1')).toBe(1);
    expect(parseReplaySpeed('5')).toBe(5);
    expect(parseReplaySpeed('10')).toBe(10);
    expect(parseReplaySpeed('50')).toBe(50);
    expect(parseReplaySpeed('MAX')).toBe('max');
    expect(() => parseReplaySpeed('2')).toThrow('replay speed must be');
  });
});

describe('HTTP ingestion client', () => {
  it('posts events to the ingestion API', async () => {
    const request = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    );
    const client = new HttpEventIngestionClient(
      'http://localhost:3000',
      request,
    );

    await client.submit(events[0]!);

    expect(request).toHaveBeenCalledWith(
      new URL('http://localhost:3000/v1/events'),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(events[0]),
      },
    );
  });

  it('stops when the ingestion API rejects an event', async () => {
    const request = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 503 }),
    );
    const client = new HttpEventIngestionClient(
      'http://localhost:3000',
      request,
    );

    await expect(client.submit(events[0]!)).rejects.toThrow(
      'rejected event event-1 with status 503',
    );
  });
});

function createIngestionClient(): EventIngestionClient {
  return { submit: vi.fn(async () => undefined) };
}

function createEvent(sequence: number, occurredAt: string): GameEvent {
  return {
    eventId: `event-${sequence}`,
    gameId: 'replay-game-1',
    sequence,
    eventType: sequence === 3 ? 'game_end' : 'period_start',
    occurredAt,
    period: sequence === 3 ? 4 : 1,
    clock: sequence === 3 ? '0:00' : '12:00',
    description: `Replay event ${sequence}`,
    source: 'historical-replay',
  };
}
