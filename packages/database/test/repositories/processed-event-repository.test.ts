import { describe, expect, it } from 'vitest';

import { ProcessedEventRepository } from '../../src/index.js';
import { gameEvent } from './fixtures.js';
import { createTestDatabase } from './test-database.js';

describe('ProcessedEventRepository', () => {
  it('marks an event once for a consumer', async () => {
    const { database, query } = createTestDatabase({
      rowCount: 1,
      rows: [{ event_id: gameEvent.eventId }],
    });
    const repository = new ProcessedEventRepository(database);

    await expect(
      repository.markProcessed('game-state', gameEvent.eventId),
    ).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT DO NOTHING'),
      ['game-state', gameEvent.eventId],
    );
  });

  it('reports an event already processed by a consumer', async () => {
    const { database } = createTestDatabase({
      rowCount: 1,
      rows: [{ '?column?': 1 }],
    });
    const repository = new ProcessedEventRepository(database);

    await expect(
      repository.hasProcessed('game-state', gameEvent.eventId),
    ).resolves.toBe(true);
  });

  it('reports duplicate marks without throwing', async () => {
    const { database } = createTestDatabase({ rowCount: 0, rows: [] });
    const repository = new ProcessedEventRepository(database);

    await expect(
      repository.markProcessed('game-state', gameEvent.eventId),
    ).resolves.toBe(false);
  });
});
