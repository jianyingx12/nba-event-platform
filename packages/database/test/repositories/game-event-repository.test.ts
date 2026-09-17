import { describe, expect, it } from 'vitest';

import { GameEventRepository } from '../../src/index.js';
import { gameEvent } from './fixtures.js';
import { createTestDatabase } from './test-database.js';

describe('GameEventRepository', () => {
  it('reports when an event is inserted', async () => {
    const { database, query } = createTestDatabase({
      rowCount: 1,
      rows: [{ event_id: gameEvent.eventId }],
    });
    const repository = new GameEventRepository(database);

    await expect(repository.insert(gameEvent)).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT DO NOTHING'),
      expect.arrayContaining([gameEvent.eventId, gameEvent.gameId]),
    );
  });

  it('reports a duplicate event without throwing', async () => {
    const { database } = createTestDatabase({ rowCount: 0, rows: [] });
    const repository = new GameEventRepository(database);

    await expect(repository.insert(gameEvent)).resolves.toBe(false);
  });

  it('returns a game event list in database order', async () => {
    const nextEvent = {
      ...gameEvent,
      eventId: 'evt-106',
      sequence: 106,
      eventType: 'rebound' as const,
      points: undefined,
      description: 'NYK defensive rebound',
    };
    const { database, query } = createTestDatabase({
      rowCount: 2,
      rows: [{ payload: gameEvent }, { payload: nextEvent }],
    });
    const repository = new GameEventRepository(database);

    await expect(repository.listByGameId(gameEvent.gameId)).resolves.toEqual([
      gameEvent,
      nextEvent,
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY sequence ASC'),
      [gameEvent.gameId],
    );
  });

  it('returns a limited list with the newest events first', async () => {
    const { database, query } = createTestDatabase({
      rowCount: 1,
      rows: [{ payload: gameEvent }],
    });
    const repository = new GameEventRepository(database);

    await expect(
      repository.listRecentByGameId(gameEvent.gameId, 10),
    ).resolves.toEqual([gameEvent]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY sequence DESC'),
      [gameEvent.gameId, 10],
    );
  });
});
