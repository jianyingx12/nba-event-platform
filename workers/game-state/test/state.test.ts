import { describe, expect, it } from 'vitest';

import { applyGameEvent, createInitialGameState } from '../src/index.js';
import { createEvent, game } from './fixtures.js';

describe('game state', () => {
  it('creates an empty state from a game', () => {
    expect(createInitialGameState(game)).toEqual({
      gameId: game.gameId,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      homeScore: 0,
      awayScore: 0,
      period: 0,
      clock: '12:00',
      status: 'scheduled',
      lastProcessedSequence: 0,
    });
  });

  it('updates the score for both teams', () => {
    const initial = applyGameEvent(
      createInitialGameState(game),
      createEvent({ eventType: 'period_start' }),
    );
    const homeScore = applyGameEvent(
      initial,
      createEvent({
        eventId: 'evt-2',
        sequence: 2,
        eventType: 'shot_made',
        clock: '11:43',
        teamId: game.homeTeamId,
        points: 3,
      }),
    );
    const awayScore = applyGameEvent(
      homeScore,
      createEvent({
        eventId: 'evt-3',
        sequence: 3,
        eventType: 'free_throw_made',
        clock: '11:20',
        teamId: game.awayTeamId,
        points: 1,
      }),
    );

    expect(awayScore.homeScore).toBe(3);
    expect(awayScore.awayScore).toBe(1);
    expect(awayScore.clock).toBe('11:20');
    expect(awayScore.lastProcessedSequence).toBe(3);
  });

  it('moves the game through live and final states', () => {
    const live = applyGameEvent(
      createInitialGameState(game),
      createEvent({ eventType: 'period_start' }),
    );
    const final = applyGameEvent(
      live,
      createEvent({
        eventId: 'evt-2',
        sequence: 2,
        eventType: 'game_end',
        period: 4,
        clock: '0:00',
      }),
    );

    expect(live.status).toBe('live');
    expect(final.status).toBe('final');
    expect(final.period).toBe(4);
    expect(final.clock).toBe('0:00');
  });

  it('rejects an event for a different game', () => {
    expect(() =>
      applyGameEvent(
        createInitialGameState(game),
        createEvent({ gameId: 'another-game' }),
      ),
    ).toThrow('belongs to a different game');
  });

  it('rejects duplicate and out-of-order events', () => {
    const current = applyGameEvent(createInitialGameState(game), createEvent());

    expect(() => applyGameEvent(current, createEvent())).toThrow(
      'sequence 1 is not after 1',
    );
    expect(() =>
      applyGameEvent(current, createEvent({ eventId: 'evt-1', sequence: 1 })),
    ).toThrow('sequence 1 is not after 1');
  });

  it('rejects an event when an earlier sequence is missing', () => {
    expect(() =>
      applyGameEvent(
        createInitialGameState(game),
        createEvent({ eventId: 'evt-3', sequence: 3 }),
      ),
    ).toThrow('sequence 3 arrived before sequence 1');
  });

  it('rejects a scoring event without a known team and point value', () => {
    const initial = createInitialGameState(game);

    expect(() =>
      applyGameEvent(initial, createEvent({ eventType: 'shot_made' })),
    ).toThrow('is missing team or points');
    expect(() =>
      applyGameEvent(
        initial,
        createEvent({
          eventType: 'shot_made',
          teamId: 'UNKNOWN',
          points: 2,
        }),
      ),
    ).toThrow('has an unknown team');
  });
});
