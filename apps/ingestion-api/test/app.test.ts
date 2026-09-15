import { afterEach, describe, expect, it } from 'vitest';

import { buildApp, type GameStore } from '../src/index.js';

const apps = [] as ReturnType<typeof buildApp>[];
const eventBus = { publish: async () => 'message-1' };
const eventStore = { insert: async () => true };
const gameStore: GameStore = { save: async (game) => game };

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('ingestion API health routes', () => {
  it('reports that the process is healthy', async () => {
    const app = buildApp({ eventBus, eventStore, gameStore });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('reports ready when its dependency check succeeds', async () => {
    const app = buildApp({
      eventBus,
      eventStore,
      gameStore,
      readinessCheck: async () => true,
    });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ready' });
  });

  it('reports unavailable when its dependency check fails', async () => {
    const app = buildApp({
      eventBus,
      eventStore,
      gameStore,
      readinessCheck: async () => false,
    });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'unavailable' });
  });
});
