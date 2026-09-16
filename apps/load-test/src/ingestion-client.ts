import type { Game, GameEvent } from '@nba-event-platform/schemas';

export type RequestOutcome = 'accepted' | 'duplicate' | 'failed';

export interface RequestResult {
  latencyMs: number;
  outcome: RequestOutcome;
}

export interface LoadTestIngestionClient {
  registerGame(game: Game): Promise<RequestResult>;
  publishEvent(event: GameEvent): Promise<RequestResult>;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export class HttpLoadTestIngestionClient implements LoadTestIngestionClient {
  constructor(
    private readonly baseUrl: string,
    private readonly request: Fetch = fetch,
    private readonly now: () => number = performance.now.bind(performance),
  ) {}

  async registerGame(game: Game): Promise<RequestResult> {
    return this.post('/v1/games', game);
  }

  async publishEvent(event: GameEvent): Promise<RequestResult> {
    return this.post('/v1/events', event);
  }

  private async post(
    path: string,
    body: Game | GameEvent,
  ): Promise<RequestResult> {
    const startedAt = this.now();

    try {
      const response = await this.request(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await readJson(response);

      return {
        latencyMs: this.now() - startedAt,
        outcome: classifyResponse(response, payload),
      };
    } catch {
      return {
        latencyMs: this.now() - startedAt,
        outcome: 'failed',
      };
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function classifyResponse(
  response: Response,
  payload: unknown,
): RequestOutcome {
  if (!response.ok || !isObject(payload)) {
    return 'failed';
  }

  if (payload.accepted === true) {
    return 'accepted';
  }

  if (payload.accepted === false && payload.reason === 'duplicate_event') {
    return 'duplicate';
  }

  return 'failed';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
