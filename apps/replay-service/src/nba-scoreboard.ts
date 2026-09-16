import {
  gameSchema,
  type Game,
  type GameStatus,
} from '@nba-event-platform/schemas';

interface NbaScoreboardGame {
  gameId: string;
  gameStatus: number;
  gameStatusText?: string;
  gameTimeUTC: string;
  homeTeam: { teamId: number };
  awayTeam: { teamId: number };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readScoreboardGames(payload: unknown): NbaScoreboardGame[] {
  if (!isRecord(payload) || !isRecord(payload.scoreboard)) {
    throw new TypeError('NBA scoreboard response is missing scoreboard');
  }

  const { games } = payload.scoreboard;
  if (!Array.isArray(games)) {
    throw new TypeError('NBA scoreboard response is missing games');
  }

  return games as NbaScoreboardGame[];
}

function mapStatus(game: NbaScoreboardGame): GameStatus {
  const statusText = game.gameStatusText?.toLowerCase() ?? '';

  if (statusText.includes('postponed')) return 'postponed';
  if (statusText.includes('cancelled') || statusText.includes('canceled')) {
    return 'cancelled';
  }
  if (game.gameStatus === 1) return 'scheduled';
  if (game.gameStatus === 2) return 'live';
  if (game.gameStatus === 3) return 'final';

  throw new TypeError(`unsupported NBA game status: ${game.gameStatus}`);
}

export function mapNbaScoreboard(payload: unknown): Game[] {
  return readScoreboardGames(payload).map((game) =>
    gameSchema.parse({
      gameId: game.gameId,
      homeTeamId: String(game.homeTeam?.teamId ?? ''),
      awayTeamId: String(game.awayTeam?.teamId ?? ''),
      scheduledAt: game.gameTimeUTC,
      status: mapStatus(game),
    }),
  );
}
