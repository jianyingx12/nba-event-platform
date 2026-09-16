import type { Server } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { closeHealthServer, startHealthServer } from '../src/index.js';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeHealthServer));
});

describe('health server', () => {
  it('reports process health', async () => {
    const url = await startServer(() => false);

    const response = await fetch(`${url}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('reports dependency readiness', async () => {
    const readyUrl = await startServer(() => true);
    const unavailableUrl = await startServer(() => false);
    const failingUrl = await startServer(() => {
      throw new Error('dependency unavailable');
    });

    const [ready, unavailable, failing] = await Promise.all([
      fetch(`${readyUrl}/ready`),
      fetch(`${unavailableUrl}/ready`),
      fetch(`${failingUrl}/ready`),
    ]);

    expect(ready.status).toBe(200);
    await expect(ready.json()).resolves.toEqual({ status: 'ready' });
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({
      status: 'unavailable',
    });
    expect(failing.status).toBe(503);
  });

  it('returns not found for unknown routes', async () => {
    const url = await startServer(() => true);

    const response = await fetch(`${url}/unknown`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'not_found' });
  });
});

async function startServer(
  readinessCheck: () => boolean | Promise<boolean>,
): Promise<string> {
  const server = await startHealthServer({
    host: '127.0.0.1',
    port: 0,
    readinessCheck,
  });
  servers.push(server);
  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('health server did not bind to a TCP port');
  }

  return `http://127.0.0.1:${address.port}`;
}
