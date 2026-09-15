import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseReplayFixture, readReplayFixture } from '../src/index.js';

const game = {
  gameId: 'replay-game-1',
  homeTeamId: 'BOS',
  awayTeamId: 'NYK',
  scheduledAt: '2026-01-15T00:00:00.000Z',
  status: 'final',
};

function createEvent(sequence: number) {
  return {
    eventId: `event-${sequence}`,
    gameId: game.gameId,
    sequence,
    eventType: sequence === 2 ? 'game_end' : 'period_start',
    occurredAt: '2026-01-15T00:05:00.000Z',
    period: sequence === 2 ? 4 : 1,
    clock: sequence === 2 ? '0:00' : '12:00',
    description: `Replay event ${sequence}`,
    source: 'historical-replay',
  };
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  );
});

describe('replay fixtures', () => {
  it('reads a valid fixture from JSON', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nba-replay-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'game.json');
    const fixture = { game, events: [createEvent(1), createEvent(2)] };
    await writeFile(filePath, JSON.stringify(fixture), 'utf8');

    await expect(readReplayFixture(filePath)).resolves.toEqual(fixture);
  });

  it('rejects empty, mismatched, duplicate, and unordered event lists', () => {
    expect(() => parseReplayFixture({ game, events: [] })).toThrow(
      'at least one event',
    );
    expect(() =>
      parseReplayFixture({
        game,
        events: [{ ...createEvent(1), gameId: 'another-game' }],
      }),
    ).toThrow('belongs to a different game');
    expect(() =>
      parseReplayFixture({
        game,
        events: [createEvent(1), { ...createEvent(2), eventId: 'event-1' }],
      }),
    ).toThrow('duplicate event id');
    expect(() =>
      parseReplayFixture({ game, events: [createEvent(2), createEvent(1)] }),
    ).toThrow('ordered by ascending sequence');
  });
});
