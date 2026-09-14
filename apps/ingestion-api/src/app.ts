import Fastify, { type FastifyInstance } from 'fastify';

export interface AppOptions {
  readinessCheck?: () => boolean | Promise<boolean>;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify();
  const readinessCheck = options.readinessCheck ?? (() => true);

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_request, reply) => {
    try {
      if (await readinessCheck()) {
        return { status: 'ready' };
      }
    } catch (error) {
      app.log.error(error, 'Readiness check failed');
    }

    return reply.status(503).send({ status: 'unavailable' });
  });

  return app;
}
