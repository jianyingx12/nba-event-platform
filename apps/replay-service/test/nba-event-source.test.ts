import { describe, expect, it, vi } from 'vitest';

import { NbaEventSource } from '../src/index.js';

const game = {
  gameId: '0022500001',
  gameStatus: 2,
  gameStatusText: 'Q1 11:45',
  gameTimeUTC: '2026-01-15T00:30:00Z',
  homeTeam: { teamId: 1610612738 },
  awayTeam: { teamId: 1610612752 },
};

const action = {
  actionNumber: 2,
  actionType: 'period',
  subType: 'start',
  clock: 'PT12M00.00S',
  period: 1,
  timeActual: '2026-01-15T00:30:00.000Z',
};

describe('NBA event source', () => {
  it("fetches today's games", async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({ scoreboard: { games: [game] } }),
    );
    const source = new NbaEventSource(request);

    await expect(source.listGames()).resolves.toMatchObject([
      { gameId: game.gameId, status: 'live' },
    ]);
    expect(request).toHaveBeenCalledWith(
      'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json',
      { headers: { accept: 'application/json' }, signal: undefined },
    );
  });

  it('polls for new actions without yielding duplicates', async () => {
    const shot = {
      ...action,
      actionNumber: 5,
      actionType: '2pt',
      subType: 'layup',
      shotResult: 'Made',
      personId: 101,
      teamId: game.homeTeam.teamId,
    };
    const gameEnd = {
      ...action,
      actionNumber: 500,
      actionType: 'game',
      subType: 'end',
      clock: 'PT00M00.00S',
      period: 4,
    };
    const snapshots = [[action], [action, shot], [action, shot, gameEnd]];
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({
        game: { gameId: game.gameId, actions: snapshots.shift() },
      }),
    );
    const wait = vi.fn(async () => undefined);
    const source = new NbaEventSource(request, wait);

    const events = [];
    for await (const event of source.streamGame(game.gameId, {
      pollIntervalMs: 25,
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.eventType)).toEqual([
      'period_start',
      'shot_made',
      'game_end',
    ]);
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(request).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(25);
    expect(request.mock.calls[0]?.[0].toString()).toBe(
      `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${game.gameId}.json`,
    );
  });

  it('passes an abort signal to play-by-play requests', async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({ game: { gameId: game.gameId, actions: [] } }),
    );
    const controller = new AbortController();
    const source = new NbaEventSource(request, async () => {
      controller.abort();
    });

    for await (const event of source.streamGame(game.gameId, {
      signal: controller.signal,
    })) {
      void event;
    }

    expect(request.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reports unsupported dates and failed requests', async () => {
    const source = new NbaEventSource(
      vi.fn<typeof fetch>(async () => new Response(null, { status: 503 })),
    );

    await expect(source.listGames({ date: '2026-01-15' })).rejects.toThrow(
      "only provides today's games",
    );
    await expect(source.listGames()).rejects.toThrow('status 503');
  });
});
