import { describe, expect, it } from 'vitest';

import { mapNbaScoreboard } from '../src/index.js';

describe('NBA scoreboard mapping', () => {
  it('maps NBA games to canonical games', () => {
    const games = mapNbaScoreboard({
      scoreboard: {
        games: [
          {
            gameId: '0022500001',
            gameStatus: 2,
            gameStatusText: 'Q3 04:12',
            gameTimeUTC: '2026-01-15T00:30:00Z',
            homeTeam: { teamId: 1610612738 },
            awayTeam: { teamId: 1610612752 },
          },
        ],
      },
    });

    expect(games).toEqual([
      {
        gameId: '0022500001',
        homeTeamId: '1610612738',
        awayTeamId: '1610612752',
        scheduledAt: '2026-01-15T00:30:00Z',
        status: 'live',
      },
    ]);
  });

  it('recognizes final and postponed games', () => {
    const games = mapNbaScoreboard({
      scoreboard: {
        games: [
          {
            gameId: 'final-game',
            gameStatus: 3,
            gameStatusText: 'Final',
            gameTimeUTC: '2026-01-15T00:30:00Z',
            homeTeam: { teamId: 1 },
            awayTeam: { teamId: 2 },
          },
          {
            gameId: 'postponed-game',
            gameStatus: 1,
            gameStatusText: 'Postponed',
            gameTimeUTC: '2026-01-16T00:30:00Z',
            homeTeam: { teamId: 3 },
            awayTeam: { teamId: 4 },
          },
        ],
      },
    });

    expect(games.map((game) => game.status)).toEqual(['final', 'postponed']);
  });

  it('rejects malformed and unsupported responses', () => {
    expect(() => mapNbaScoreboard({})).toThrow('missing scoreboard');
    expect(() => mapNbaScoreboard({ scoreboard: {} })).toThrow('missing games');
    expect(() =>
      mapNbaScoreboard({
        scoreboard: {
          games: [
            {
              gameId: 'unknown-status',
              gameStatus: 9,
              gameTimeUTC: '2026-01-15T00:30:00Z',
              homeTeam: { teamId: 1 },
              awayTeam: { teamId: 2 },
            },
          ],
        },
      }),
    ).toThrow('unsupported NBA game status');
  });
});
