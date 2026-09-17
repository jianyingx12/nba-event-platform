import { describe, expect, it } from 'vitest';

import { mapNbaPlayByPlay } from '../src/index.js';

const baseAction = {
  clock: 'PT11M45.00S',
  period: 1,
  timeActual: '2026-01-15T00:31:00.000Z',
};

describe('NBA play-by-play mapping', () => {
  it('maps actions and creates dense canonical sequences', () => {
    const events = mapNbaPlayByPlay({
      game: {
        gameId: '0022500001',
        actions: [
          {
            ...baseAction,
            actionNumber: 2,
            actionType: 'period',
            subType: 'start',
          },
          {
            ...baseAction,
            actionNumber: 7,
            actionType: 'jumpball',
          },
          {
            ...baseAction,
            actionNumber: 9,
            actionType: '3pt',
            shotResult: 'Made',
            personId: 101,
            assistPersonId: 202,
            teamId: 1610612738,
            description: 'Three point shot made',
          },
        ],
      },
    });

    expect(events.map((event) => event.eventType)).toEqual([
      'period_start',
      'shot_made',
      'assist',
    ]);
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(events[1]).toMatchObject({
      eventId: 'nba:0022500001:9',
      clock: '11:45',
      playerId: '101',
      teamId: '1610612738',
      points: 3,
      sourceEventId: '9',
    });
    expect(events[2]).toMatchObject({
      eventId: 'nba:0022500001:9:assist',
      playerId: '202',
      sourceEventId: '9:assist',
    });
  });

  it('maps missed free throws and game completion', () => {
    const events = mapNbaPlayByPlay({
      game: {
        gameId: '0022500001',
        actions: [
          {
            ...baseAction,
            actionNumber: 10,
            actionType: 'freethrow',
            shotResult: 'Missed',
            personId: 101,
            teamId: 1610612738,
          },
          {
            ...baseAction,
            actionNumber: 500,
            actionType: 'game',
            subType: 'end',
            clock: 'PT00M00.00S',
            period: 4,
          },
        ],
      },
    });

    expect(events).toMatchObject([
      { eventType: 'free_throw_missed', points: 1, playerId: '101' },
      { eventType: 'game_end', clock: '0:00', period: 4 },
    ]);
  });

  it('rejects malformed responses and unsupported clocks', () => {
    expect(() => mapNbaPlayByPlay({})).toThrow('missing game');
    expect(() =>
      mapNbaPlayByPlay({
        game: {
          gameId: '0022500001',
          actions: [
            {
              ...baseAction,
              actionNumber: 1,
              actionType: 'period',
              subType: 'start',
              clock: '12:00',
            },
          ],
        },
      }),
    ).toThrow('unsupported NBA clock');
  });
});
