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
  recentEventsNextBeforeSequence: number | null;
  state: GameState | null;
  teams: Team[];
}

export interface EventPage {
  events: GameEvent[];
  nextBeforeSequence: number | null;
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

export async function loadGameEventPage(
  gameId: string,
  beforeSequence: number,
  request: typeof fetch = fetch,
): Promise<EventPage> {
  const response = await request(
    `/v1/games/${encodeURIComponent(gameId)}/events?beforeSequence=${beforeSequence}&limit=25`,
  );

  if (!response.ok) {
    throw new Error(`Event request failed with status ${response.status}`);
  }

  return (await response.json()) as EventPage;
}
