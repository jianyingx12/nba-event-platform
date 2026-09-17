import type { EventBus } from '@nba-event-platform/event-bus';
import {
  gameEventSchema,
  gameRosterSchema,
  gameSchema,
  type Game,
  type GameAnalytics,
  type GameEvent,
  type GameRoster,
  type GameState,
  type Player,
  type PlayerGameStats,
  type Team,
} from '@nba-event-platform/schemas';
import Fastify, { type FastifyInstance } from 'fastify';

export interface EventStore {
  insert(event: GameEvent): Promise<boolean>;
}

export interface GameStore {
  save(game: Game): Promise<Game>;
}

export interface RosterStore {
  save(roster: GameRoster): Promise<void>;
}

export interface DashboardReader {
  findAnalytics(gameId: string): Promise<GameAnalytics | null>;
  findGame(gameId: string): Promise<Game | null>;
  findState(gameId: string): Promise<GameState | null>;
  findPlayers(playerIds: string[]): Promise<Player[]>;
  findTeams(teamIds: string[]): Promise<Team[]>;
  listEvents(
    gameId: string,
    beforeSequence: number | undefined,
    limit: number,
  ): Promise<GameEvent[]>;
  listPlayerStats(gameId: string): Promise<PlayerGameStats[]>;
}

export interface AppOptions {
  dashboardReader?: DashboardReader;
  eventBus: Pick<EventBus, 'publish'>;
  eventStore: EventStore;
  gameStore: GameStore;
  logger?: boolean;
  readinessCheck?: () => boolean | Promise<boolean>;
  rosterStore?: RosterStore;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  const readinessCheck = options.readinessCheck ?? (() => true);

  app.get('/health', async () => ({ status: 'ok' }));

  app.get<{ Params: { gameId: string } }>(
    '/v1/games/:gameId/dashboard',
    async (request, reply) => {
      if (!options.dashboardReader) {
        return reply.status(503).send({ reason: 'dashboard_unavailable' });
      }

      const game = await options.dashboardReader.findGame(
        request.params.gameId,
      );
      if (!game) return reply.status(404).send({ reason: 'game_not_found' });

      const [state, playerStats, analytics, recentEvents] = await Promise.all([
        options.dashboardReader.findState(game.gameId),
        options.dashboardReader.listPlayerStats(game.gameId),
        options.dashboardReader.findAnalytics(game.gameId),
        options.dashboardReader.listEvents(game.gameId, undefined, 25),
      ]);

      const [teams, players] = await Promise.all([
        options.dashboardReader.findTeams([game.homeTeamId, game.awayTeamId]),
        options.dashboardReader.findPlayers(
          playerStats.map((stats) => stats.playerId),
        ),
      ]);

      return {
        game,
        state,
        teams,
        players,
        playerStats,
        analytics,
        recentEvents,
      };
    },
  );

  app.get<{
    Params: { gameId: string };
    Querystring: { beforeSequence?: string; limit?: string };
  }>('/v1/games/:gameId/events', async (request, reply) => {
    if (!options.dashboardReader) {
      return reply.status(503).send({ reason: 'dashboard_unavailable' });
    }

    const limit = parsePositiveInteger(request.query.limit ?? '25');
    const beforeSequence = request.query.beforeSequence
      ? parsePositiveInteger(request.query.beforeSequence)
      : undefined;
    if (limit === null || limit > 100 || beforeSequence === null) {
      return reply.status(400).send({ reason: 'invalid_pagination' });
    }

    const game = await options.dashboardReader.findGame(request.params.gameId);
    if (!game) return reply.status(404).send({ reason: 'game_not_found' });

    const results = await options.dashboardReader.listEvents(
      game.gameId,
      beforeSequence,
      limit + 1,
    );
    const events = results.slice(0, limit);
    const nextBeforeSequence =
      results.length > limit ? events.at(-1)?.sequence : undefined;

    return { events, nextBeforeSequence: nextBeforeSequence ?? null };
  });

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

  app.post('/v1/rosters', async (request, reply) => {
    const result = gameRosterSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        accepted: false,
        reason: 'invalid_roster',
      });
    }
    if (!options.rosterStore) {
      return reply.status(503).send({
        accepted: false,
        reason: 'roster_unavailable',
      });
    }

    await options.rosterStore.save(result.data);
    return reply.status(200).send({
      accepted: true,
      gameId: result.data.gameId,
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

function parsePositiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
