import {
  gameEventSchema,
  type GameEvent,
  type GameEventType,
} from '@nba-event-platform/schemas';

interface NbaAction {
  actionNumber: number;
  actionType: string;
  assistPersonId?: number;
  blockPersonId?: number;
  clock: string;
  description?: string;
  period: number;
  personId?: number;
  shotResult?: string;
  stealPersonId?: number;
  subType?: string;
  teamId?: number;
  timeActual: string;
}

interface EventDraft {
  eventType: GameEventType;
  playerId?: string;
  points?: number;
  suffix?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readGame(payload: unknown): { gameId: string; actions: NbaAction[] } {
  if (!isRecord(payload) || !isRecord(payload.game)) {
    throw new TypeError('NBA play-by-play response is missing game');
  }

  const { gameId, actions } = payload.game;
  if (typeof gameId !== 'string' || !Array.isArray(actions)) {
    throw new TypeError('NBA play-by-play response has an invalid game');
  }

  return { gameId, actions: actions as NbaAction[] };
}

function formatClock(value: string): string {
  const match = /^PT(\d+)M(\d{2})(?:\.(\d+))?S$/.exec(value);
  if (!match) throw new TypeError(`unsupported NBA clock: ${value}`);

  const fraction = match[3]?.replace(/0+$/, '').slice(0, 1);
  return `${Number(match[1])}:${match[2]}${fraction ? `.${fraction}` : ''}`;
}

function playerId(value: number | undefined): string | undefined {
  return value && value > 0 ? String(value) : undefined;
}

function primaryEvent(action: NbaAction): EventDraft | undefined {
  if (action.actionType === 'period' && action.subType === 'start') {
    return { eventType: 'period_start' };
  }
  if (action.actionType === 'period' && action.subType === 'end') {
    return { eventType: 'period_end' };
  }
  if (action.actionType === 'game' && action.subType === 'end') {
    return { eventType: 'game_end' };
  }
  if (action.actionType === '2pt' || action.actionType === '3pt') {
    return {
      eventType: action.shotResult === 'Made' ? 'shot_made' : 'shot_missed',
      playerId: playerId(action.personId),
      points: action.actionType === '3pt' ? 3 : 2,
    };
  }
  if (action.actionType === 'freethrow') {
    return {
      eventType:
        action.shotResult === 'Made' ? 'free_throw_made' : 'free_throw_missed',
      playerId: playerId(action.personId),
      points: 1,
    };
  }

  const eventTypes: Partial<Record<string, GameEventType>> = {
    assist: 'assist',
    block: 'block',
    foul: 'foul',
    rebound: 'rebound',
    steal: 'steal',
    substitution: 'substitution',
    timeout: 'timeout',
    turnover: 'turnover',
  };
  const eventType = eventTypes[action.actionType];
  return eventType
    ? { eventType, playerId: playerId(action.personId) }
    : undefined;
}

function eventDrafts(action: NbaAction): EventDraft[] {
  const primary = primaryEvent(action);
  if (!primary) return [];

  const drafts = [primary];
  const related: Array<[number | undefined, GameEventType]> = [
    [action.assistPersonId, 'assist'],
    [action.blockPersonId, 'block'],
    [action.stealPersonId, 'steal'],
  ];

  for (const [relatedPlayerId, eventType] of related) {
    const id = playerId(relatedPlayerId);
    if (id && primary.eventType !== eventType) {
      drafts.push({ eventType, playerId: id, suffix: eventType });
    }
  }

  return drafts;
}

export function mapNbaPlayByPlay(payload: unknown): GameEvent[] {
  const { gameId, actions } = readGame(payload);
  const events: GameEvent[] = [];

  for (const action of actions) {
    for (const draft of eventDrafts(action)) {
      const sourceEventId = `${action.actionNumber}${draft.suffix ? `:${draft.suffix}` : ''}`;
      events.push(
        gameEventSchema.parse({
          eventId: `nba:${gameId}:${sourceEventId}`,
          gameId,
          sequence: events.length + 1,
          eventType: draft.eventType,
          occurredAt: action.timeActual,
          period: action.period,
          clock: formatClock(action.clock),
          teamId: playerId(action.teamId),
          playerId: draft.playerId,
          points: draft.points,
          description:
            action.description ??
            `NBA ${action.actionType}${draft.suffix ? ` ${draft.suffix}` : ''}`,
          source: 'nba.com',
          sourceEventId,
          metadata: {
            nbaActionNumber: action.actionNumber,
            nbaActionType: action.actionType,
            nbaSubType: action.subType,
          },
        }),
      );
    }
  }

  return events;
}
