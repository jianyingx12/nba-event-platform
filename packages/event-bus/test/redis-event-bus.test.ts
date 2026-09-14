import { describe, expect, it, vi } from 'vitest';

import { RedisEventBus, type RedisStreamsClient } from '../src/index.js';
import { gameEvent } from './fixtures.js';

function createRedisClient(): RedisStreamsClient {
  return {
    isOpen: true,
    connect: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    on: vi.fn(),
    xAdd: vi.fn(async () => '1710000000000-0'),
    xGroupCreate: vi.fn(async () => 'OK'),
    xReadGroup: vi.fn(async () => null),
  };
}

describe('RedisEventBus', () => {
  it('publishes a validated event to the configured stream', async () => {
    const client = createRedisClient();
    const eventBus = new RedisEventBus(client, 'test-events');

    await expect(eventBus.publish(gameEvent)).resolves.toBe('1710000000000-0');
    expect(client.xAdd).toHaveBeenCalledWith('test-events', '*', {
      event: JSON.stringify(gameEvent),
    });
  });

  it('creates a consumer group and tolerates an existing group', async () => {
    const client = createRedisClient();
    const eventBus = new RedisEventBus(client);

    await expect(
      eventBus.ensureConsumerGroup('box-score'),
    ).resolves.toBeUndefined();
    expect(client.xGroupCreate).toHaveBeenCalledWith(
      'game-events',
      'box-score',
      '0',
      { MKSTREAM: true },
    );

    vi.mocked(client.xGroupCreate).mockRejectedValueOnce(
      new Error('BUSYGROUP Consumer Group name already exists'),
    );
    await expect(
      eventBus.ensureConsumerGroup('box-score'),
    ).resolves.toBeUndefined();
  });

  it('reads and validates new messages for a consumer', async () => {
    const client = createRedisClient();
    vi.mocked(client.xReadGroup).mockResolvedValueOnce([
      {
        name: 'game-events',
        messages: [
          {
            id: '1710000000000-0',
            message: { event: JSON.stringify(gameEvent) },
          },
        ],
      },
    ]);
    const eventBus = new RedisEventBus(client);

    await expect(
      eventBus.read({
        consumerGroup: 'box-score',
        consumerName: 'worker-1',
        count: 5,
        blockMs: 100,
      }),
    ).resolves.toEqual([{ messageId: '1710000000000-0', event: gameEvent }]);
    expect(client.xReadGroup).toHaveBeenCalledWith(
      'box-score',
      'worker-1',
      { key: 'game-events', id: '>' },
      { COUNT: 5, BLOCK: 100 },
    );
  });

  it('returns no messages when a blocking read times out', async () => {
    const eventBus = new RedisEventBus(createRedisClient());

    await expect(
      eventBus.read({
        consumerGroup: 'box-score',
        consumerName: 'worker-1',
      }),
    ).resolves.toEqual([]);
  });

  it('closes an open client', async () => {
    const client = createRedisClient();
    const eventBus = new RedisEventBus(client);

    await eventBus.close();

    expect(client.close).toHaveBeenCalledOnce();
  });
});
