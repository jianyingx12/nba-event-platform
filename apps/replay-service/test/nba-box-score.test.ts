import { describe, expect, it } from 'vitest';

import { mapNbaBoxScore, mapNbaGameRoster } from '../src/index.js';

describe('NBA box score mapping', () => {
  it('maps a completed historical game', () => {
    expect(
      mapNbaBoxScore({
        game: {
          gameId: '0022400247',
          gameStatus: 3,
          gameStatusText: 'Final',
          gameTimeUTC: '2024-11-20T00:00:00Z',
          homeTeam: { teamId: 1610612738 },
          awayTeam: { teamId: 1610612739 },
        },
      }),
    ).toEqual({
      gameId: '0022400247',
      homeTeamId: '1610612738',
      awayTeamId: '1610612739',
      scheduledAt: '2024-11-20T00:00:00Z',
      status: 'final',
    });
  });

  it('rejects a response without a game', () => {
    expect(() => mapNbaBoxScore({})).toThrow('missing game');
  });

  it('maps the teams and players in a game', () => {
    const payload = {
      game: {
        gameId: '0022400247',
        homeTeam: {
          teamId: 1610612761,
          teamCity: 'Toronto',
          teamName: 'Raptors',
          teamTricode: 'TOR',
          players: [{ personId: 1629628, name: 'RJ Barrett' }],
        },
        awayTeam: {
          teamId: 1610612754,
          teamCity: 'Indiana',
          teamName: 'Pacers',
          teamTricode: 'IND',
          players: [{ personId: 1641716, name: 'Jarace Walker' }],
        },
      },
    };

    expect(mapNbaGameRoster(payload)).toEqual({
      gameId: '0022400247',
      teams: [
        {
          teamId: '1610612761',
          abbreviation: 'TOR',
          city: 'Toronto',
          name: 'Raptors',
        },
        {
          teamId: '1610612754',
          abbreviation: 'IND',
          city: 'Indiana',
          name: 'Pacers',
        },
      ],
      players: [
        {
          playerId: '1629628',
          displayName: 'RJ Barrett',
          teamId: '1610612761',
        },
        {
          playerId: '1641716',
          displayName: 'Jarace Walker',
          teamId: '1610612754',
        },
      ],
    });
  });
});
