import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildApp,
  type DashboardReader,
  type GameStore,
} from '../src/index.js';
import { game, gameEvent, gameRoster } from './fixtures.js';

const apps = [] as ReturnType<typeof buildApp>[];
const eventBus = { publish: async () => 'message-1' };
const eventStore = { insert: async () => true };
const gameStore: GameStore = { save: async (value) => value };

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function createDashboardReader(found = true): DashboardReader {
  return {
    findGame: async () => (found ? game : null),
    findPlayers: async () => gameRoster.players,
    findState: async () => ({
      gameId: game.gameId,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      homeScore: 104,
      awayScore: 101,
      period: 4,
      clock: '2:14',
      status: 'live',
      lastProcessedSequence: 105,
    }),
    findTeams: async () => gameRoster.teams,
    listPlayerStats: async () => [],
    findAnalytics: async () => null,
    listEvents: async () => [gameEvent],
  };
}

describe('GET /v1/games/:gameId/dashboard', () => {
  it('returns the current game view', async () => {
    const app = buildApp({
      dashboardReader: createDashboardReader(),
      eventBus,
      eventStore,
      gameStore,
    });
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: `/v1/games/${game.gameId}/dashboard`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      game,
      state: { homeScore: 104, awayScore: 101 },
      teams: gameRoster.teams,
      players: gameRoster.players,
      playerStats: [],
      analytics: null,
      recentEvents: [gameEvent],
    });
  });

  it('reports a missing game', async () => {
    const app = buildApp({
      dashboardReader: createDashboardReader(false),
      eventBus,
      eventStore,
      gameStore,
    });
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/games/missing/dashboard',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ reason: 'game_not_found' });
  });
});

describe('GET /v1/games/:gameId/events', () => {
  it('returns a page and cursor for older events', async () => {
    const events = [
      gameEvent,
      { ...gameEvent, eventId: 'evt-104', sequence: 104 },
      { ...gameEvent, eventId: 'evt-103', sequence: 103 },
    ];
    const dashboardReader = createDashboardReader();
    dashboardReader.listEvents = vi.fn(async () => events);
    const app = buildApp({
      dashboardReader,
      eventBus,
      eventStore,
      gameStore,
    });
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: `/v1/games/${game.gameId}/events?beforeSequence=200&limit=2`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      events: events.slice(0, 2),
      nextBeforeSequence: 104,
    });
    expect(dashboardReader.listEvents).toHaveBeenCalledWith(
      game.gameId,
      200,
      3,
    );
  });

  it('rejects invalid pagination values', async () => {
    const app = buildApp({
      dashboardReader: createDashboardReader(),
      eventBus,
      eventStore,
      gameStore,
    });
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: `/v1/games/${game.gameId}/events?limit=0`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ reason: 'invalid_pagination' });
  });
});
