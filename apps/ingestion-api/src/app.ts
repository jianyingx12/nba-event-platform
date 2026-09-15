import type { EventBus } from '@nba-event-platform/event-bus';
import {
  gameEventSchema,
  gameSchema,
  type Game,
  type GameEvent,
} from '@nba-event-platform/schemas';
import Fastify, { type FastifyInstance } from 'fastify';

export interface EventStore {
  insert(event: GameEvent): Promise<boolean>;
}

export interface GameStore {
  save(game: Game): Promise<Game>;
}

export interface AppOptions {
  eventBus: Pick<EventBus, 'publish'>;
  eventStore: EventStore;
  gameStore: GameStore;
  logger?: boolean;
  readinessCheck?: () => boolean | Promise<boolean>;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
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

  app.post('/v1/games', async (request, reply) => {
    const result = gameSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        accepted: false,
        reason: 'invalid_game',
      });
    }

    const game = await options.gameStore.save(result.data);

    return reply.status(200).send({
      accepted: true,
      gameId: game.gameId,
    });
  });

  app.post('/v1/events', async (request, reply) => {
    const result = gameEventSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        accepted: false,
        reason: 'invalid_event',
      });
    }

    const inserted = await options.eventStore.insert(result.data);

    if (!inserted) {
      return reply.status(200).send({
        accepted: false,
        reason: 'duplicate_event',
      });
    }

    await options.eventBus.publish(result.data);

    return reply.status(202).send({
      accepted: true,
      eventId: result.data.eventId,
    });
  });

  return app;
}
