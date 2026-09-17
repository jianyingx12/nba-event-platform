import { afterEach, describe, expect, it } from 'vitest';

import {
  buildApp,
  type DashboardReader,
  type GameStore,
} from '../src/index.js';
import { game, gameEvent } from './fixtures.js';

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
    listPlayerStats: async () => [],
    findAnalytics: async () => null,
    listRecentEvents: async () => [gameEvent],
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
