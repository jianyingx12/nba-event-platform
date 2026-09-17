import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '@nba-event-platform/schemas';

import { buildApp, type RosterStore } from '../src/index.js';
import { gameRoster } from './fixtures.js';

const apps = [] as ReturnType<typeof buildApp>[];
const eventBus = { publish: async () => 'message-1' };
const eventStore = { insert: async () => true };
const gameStore = { save: async (game: Game) => game };

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('POST /v1/rosters', () => {
  it('saves a valid game roster', async () => {
    const rosterStore: RosterStore = { save: vi.fn(async () => undefined) };
    const app = buildApp({
      eventBus,
      eventStore,
      gameStore,
      rosterStore,
    });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/rosters',
      payload: gameRoster,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accepted: true,
      gameId: gameRoster.gameId,
    });
    expect(rosterStore.save).toHaveBeenCalledWith(gameRoster);
  });

  it('rejects an invalid game roster', async () => {
    const rosterStore: RosterStore = { save: vi.fn(async () => undefined) };
    const app = buildApp({
      eventBus,
      eventStore,
      gameStore,
      rosterStore,
    });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/rosters',
      payload: { ...gameRoster, teams: [] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      accepted: false,
      reason: 'invalid_roster',
    });
    expect(rosterStore.save).not.toHaveBeenCalled();
  });
});
