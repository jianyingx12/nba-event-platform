import { describe, expect, it } from 'vitest';

import { mapNbaBoxScore } from '../src/index.js';

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
});
