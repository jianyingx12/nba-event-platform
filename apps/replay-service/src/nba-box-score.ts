import type { Game } from '@nba-event-platform/schemas';

import { mapNbaScoreboard } from './nba-scoreboard.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function mapNbaBoxScore(payload: unknown): Game {
  if (!isRecord(payload) || !isRecord(payload.game)) {
    throw new TypeError('NBA box score response is missing game');
  }

  const game = mapNbaScoreboard({ scoreboard: { games: [payload.game] } })[0];
  if (!game) throw new TypeError('NBA box score response has an invalid game');

  return game;
}
