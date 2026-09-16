import { describe, expect, it } from 'vitest';

import {
  applyAnalyticsEvent,
  createInitialGameAnalytics,
} from '../src/index.js';
import { createEvent, game } from './fixtures.js';

describe('game analytics', () => {
  it('creates empty analytics for both teams', () => {
    const analytics = createInitialGameAnalytics(game);

    expect(analytics).toEqual({
      gameId: game.gameId,
      homeTeam: expect.objectContaining({
        teamId: game.homeTeamId,
        points: 0,
        turnovers: 0,
        fieldGoalPercentage: 0,
        threePointPercentage: 0,
        freeThrowPercentage: 0,
      }),
      awayTeam: expect.objectContaining({
        teamId: game.awayTeamId,
        points: 0,
      }),
      lastProcessedSequence: 0,
    });
  });

  it('derives shooting percentages and turnovers from events', () => {
    let analytics = createInitialGameAnalytics(game);
    analytics = applyAnalyticsEvent(analytics, createEvent());
    analytics = applyAnalyticsEvent(
      analytics,
      createEvent({
        eventId: 'evt-2',
        sequence: 2,
        eventType: 'shot_missed',
        points: 2,
      }),
    );
    analytics = applyAnalyticsEvent(
      analytics,
      createEvent({
        eventId: 'evt-3',
        sequence: 3,
        eventType: 'free_throw_made',
        points: 1,
      }),
    );
    analytics = applyAnalyticsEvent(
      analytics,
      createEvent({
        eventId: 'evt-4',
        sequence: 4,
        eventType: 'free_throw_missed',
        points: undefined,
      }),
    );
    analytics = applyAnalyticsEvent(
      analytics,
      createEvent({
        eventId: 'evt-5',
        sequence: 5,
        eventType: 'turnover',
        points: undefined,
      }),
    );

    expect(analytics.homeTeam).toEqual({
      teamId: game.homeTeamId,
      points: 4,
      turnovers: 1,
      fieldGoalsMade: 1,
      fieldGoalsAttempted: 2,
      fieldGoalPercentage: 0.5,
      threePointersMade: 1,
      threePointersAttempted: 1,
      threePointPercentage: 1,
      freeThrowsMade: 1,
      freeThrowsAttempted: 2,
      freeThrowPercentage: 0.5,
    });
    expect(analytics.lastProcessedSequence).toBe(5);
  });

  it('tracks each team independently', () => {
    const initial = createInitialGameAnalytics(game);
    const analytics = applyAnalyticsEvent(
      initial,
      createEvent({ teamId: game.awayTeamId, points: 2 }),
    );

    expect(analytics.homeTeam.points).toBe(0);
    expect(analytics.awayTeam.points).toBe(2);
  });

  it('rejects events for another game', () => {
    const analytics = createInitialGameAnalytics(game);

    expect(() =>
      applyAnalyticsEvent(analytics, createEvent({ gameId: 'different-game' })),
    ).toThrow('belongs to a different game');
  });

  it('rejects duplicate and out-of-order events', () => {
    const analytics = applyAnalyticsEvent(
      createInitialGameAnalytics(game),
      createEvent(),
    );

    expect(() => applyAnalyticsEvent(analytics, createEvent())).toThrow(
      'sequence 1 is not after 1',
    );
  });

  it('rejects an event when an earlier sequence is missing', () => {
    expect(() =>
      applyAnalyticsEvent(
        createInitialGameAnalytics(game),
        createEvent({ eventId: 'evt-3', sequence: 3 }),
      ),
    ).toThrow('sequence 3 arrived before sequence 1');
  });
});
