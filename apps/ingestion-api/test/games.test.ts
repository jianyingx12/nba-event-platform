import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp, type GameStore } from '../src/index.js';
import { game } from './fixtures.js';

const apps = [] as ReturnType<typeof buildApp>[];
const eventBus = { publish: async () => 'message-1' };
const eventStore = { insert: async () => true };

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function createGameStore(): GameStore {
  return {
    save: vi.fn(async (value) => value),
  };
}

describe('POST /v1/games', () => {
  it('saves a valid game', async () => {
    const gameStore = createGameStore();
    const app = buildApp({ eventBus, eventStore, gameStore });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/games',
      payload: game,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accepted: true,
      gameId: game.gameId,
    });
    expect(gameStore.save).toHaveBeenCalledWith(game);
  });

  it('rejects an invalid game', async () => {
    const gameStore = createGameStore();
    const app = buildApp({ eventBus, eventStore, gameStore });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/games',
      payload: { ...game, awayTeamId: game.homeTeamId },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      accepted: false,
      reason: 'invalid_game',
    });
    expect(gameStore.save).not.toHaveBeenCalled();
  });
});
