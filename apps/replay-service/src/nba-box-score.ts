import {
  gameRosterSchema,
  type Game,
  type GameRoster,
  type Player,
  type Team,
} from '@nba-event-platform/schemas';

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

export function mapNbaGameRoster(payload: unknown): GameRoster {
  if (!isRecord(payload) || !isRecord(payload.game)) {
    throw new TypeError('NBA box score response is missing game');
  }

  const gameId = String(payload.game.gameId ?? '');
  const homeTeam = mapTeam(payload.game.homeTeam);
  const awayTeam = mapTeam(payload.game.awayTeam);

  return gameRosterSchema.parse({
    gameId,
    teams: [homeTeam.team, awayTeam.team],
    players: [...homeTeam.players, ...awayTeam.players],
  });
}

function mapTeam(value: unknown): { team: Team; players: Player[] } {
  if (!isRecord(value) || !Array.isArray(value.players)) {
    throw new TypeError('NBA box score response has an invalid team');
  }

  const teamId = String(value.teamId ?? '');
  return {
    team: {
      teamId,
      abbreviation: String(value.teamTricode ?? ''),
      city: String(value.teamCity ?? ''),
      name: String(value.teamName ?? ''),
    },
    players: value.players.map((player) => mapPlayer(player, teamId)),
  };
}

function mapPlayer(value: unknown, teamId: string): Player {
  if (!isRecord(value)) {
    throw new TypeError('NBA box score response has an invalid player');
  }

  return {
    playerId: String(value.personId ?? ''),
    displayName: String(value.name ?? ''),
    teamId,
  };
}
