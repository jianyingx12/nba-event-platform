import type {
  Game,
  GameAnalytics,
  GameEvent,
  GameState,
  Player,
  PlayerGameStats,
  Team,
} from '@nba-event-platform/schemas';

export interface DashboardGame {
  analytics: GameAnalytics | null;
  game: Game;
  players: Player[];
  playerStats: PlayerGameStats[];
  recentEvents: GameEvent[];
  state: GameState | null;
  teams: Team[];
}

export async function loadDashboardGame(
  gameId: string,
  request: typeof fetch = fetch,
): Promise<DashboardGame> {
  const response = await request(
    `/v1/games/${encodeURIComponent(gameId)}/dashboard`,
  );

  if (response.status === 404) {
    throw new Error(`Game ${gameId} was not found`);
  }
  if (!response.ok) {
    throw new Error(`Dashboard request failed with status ${response.status}`);
  }

  return (await response.json()) as DashboardGame;
}
