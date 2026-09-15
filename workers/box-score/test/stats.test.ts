import { describe, expect, it } from 'vitest';

import {
  applyPlayerGameEvent,
  createInitialPlayerGameStats,
} from '../src/index.js';
import { createEvent } from './fixtures.js';

const gameId = 'bos-nyk-2026-01';
const playerId = 'player-0';

describe('player game stats', () => {
  it('creates an empty stat line', () => {
    expect(createInitialPlayerGameStats(gameId, playerId)).toEqual({
      gameId,
      playerId,
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      threePointersMade: 0,
      threePointersAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
    });
  });

  it('tracks shooting and points', () => {
    let stats = createInitialPlayerGameStats(gameId, playerId);
    const events = [
      createEvent({ eventType: 'shot_made', points: 3 }),
      createEvent({ eventType: 'shot_missed', points: 3 }),
      createEvent({ eventType: 'shot_made', points: 2 }),
      createEvent({ eventType: 'free_throw_made', points: 1 }),
      createEvent({ eventType: 'free_throw_missed' }),
    ];

    for (const event of events) {
      stats = applyPlayerGameEvent(stats, event);
    }

    expect(stats).toEqual(
      expect.objectContaining({
        points: 6,
        fieldGoalsMade: 2,
        fieldGoalsAttempted: 3,
        threePointersMade: 1,
        threePointersAttempted: 2,
        freeThrowsMade: 1,
        freeThrowsAttempted: 2,
      }),
    );
  });

  it('tracks common counting statistics', () => {
    let stats = createInitialPlayerGameStats(gameId, playerId);

    for (const eventType of [
      'rebound',
      'assist',
      'steal',
      'block',
      'turnover',
    ] as const) {
      stats = applyPlayerGameEvent(stats, createEvent({ eventType }));
    }

    expect(stats).toEqual(
      expect.objectContaining({
        rebounds: 1,
        assists: 1,
        steals: 1,
        blocks: 1,
        turnovers: 1,
      }),
    );
  });

  it('rejects events for another game or player', () => {
    const stats = createInitialPlayerGameStats(gameId, playerId);

    expect(() =>
      applyPlayerGameEvent(stats, createEvent({ gameId: 'another-game' })),
    ).toThrow('belongs to a different game');
    expect(() =>
      applyPlayerGameEvent(stats, createEvent({ playerId: 'another-player' })),
    ).toThrow('belongs to a different player');
  });

  it('rejects scoring events without a valid point value', () => {
    const stats = createInitialPlayerGameStats(gameId, playerId);

    expect(() =>
      applyPlayerGameEvent(stats, createEvent({ eventType: 'shot_made' })),
    ).toThrow('must be worth two or three points');
    expect(() =>
      applyPlayerGameEvent(
        stats,
        createEvent({ eventType: 'free_throw_made', points: 2 }),
      ),
    ).toThrow('must be worth one point');
  });
});
