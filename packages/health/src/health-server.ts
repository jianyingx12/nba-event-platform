import { createServer, type Server } from 'node:http';

export interface HealthServerOptions {
  host: string;
  port: number;
  readinessCheck: () => boolean | Promise<boolean>;
}

export async function startHealthServer(
  options: HealthServerOptions,
): Promise<Server> {
  const server = createServer((request, response) => {
    void handleRequest(request.method, request.url, response, options);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  return server;
}

export async function closeHealthServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function handleRequest(
  method: string | undefined,
  url: string | undefined,
  response: import('node:http').ServerResponse,
  options: HealthServerOptions,
): Promise<void> {
  if (method !== 'GET') {
    sendJson(response, 404, { error: 'not_found' });
    return;
  }

  if (url === '/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (url === '/ready') {
    try {
      if (await options.readinessCheck()) {
        sendJson(response, 200, { status: 'ready' });
        return;
      }
    } catch {
      // Dependency failures are reported as unavailable.
    }

    sendJson(response, 503, { status: 'unavailable' });
    return;
  }

  sendJson(response, 404, { error: 'not_found' });
}

function sendJson(
  response: import('node:http').ServerResponse,
  statusCode: number,
  body: Record<string, string>,
): void {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}
