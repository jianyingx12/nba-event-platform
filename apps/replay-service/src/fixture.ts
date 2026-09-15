import { readFile } from 'node:fs/promises';

import {
  gameEventSchema,
  gameSchema,
  type Game,
  type GameEvent,
} from '@nba-event-platform/schemas';

export interface ReplayFixture {
  game: Game;
  events: GameEvent[];
}

export function parseReplayFixture(value: unknown): ReplayFixture {
  if (!isRecord(value) || !Array.isArray(value.events)) {
    throw new Error('replay fixture must contain a game and an events array');
  }

  const game = gameSchema.parse(value.game);
  const events = value.events.map((event) => gameEventSchema.parse(event));

  if (events.length === 0) {
    throw new Error('replay fixture must contain at least one event');
  }

  const eventIds = new Set<string>();
  let previousSequence = 0;

  for (const event of events) {
    if (event.gameId !== game.gameId) {
      throw new Error(`event ${event.eventId} belongs to a different game`);
    }
    if (eventIds.has(event.eventId)) {
      throw new Error(`duplicate event id ${event.eventId}`);
    }
    if (event.sequence <= previousSequence) {
      throw new Error('replay events must be ordered by ascending sequence');
    }

    eventIds.add(event.eventId);
    previousSequence = event.sequence;
  }

  return { game, events };
}

export async function readReplayFixture(
  filePath: string,
): Promise<ReplayFixture> {
  const contents = await readFile(filePath, 'utf8');
  return parseReplayFixture(JSON.parse(contents) as unknown);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
