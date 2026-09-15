import { describe, expect, it, vi } from 'vitest';

import { RedisEventBus, type RedisStreamsClient } from '../src/index.js';
import { gameEvent } from './fixtures.js';

function createRedisClient(): RedisStreamsClient {
  return {
    isOpen: true,
    isReady: true,
    connect: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    on: vi.fn(),
    xAdd: vi.fn(async () => '1710000000000-0'),
    xAck: vi.fn(async () => 1),
    xAutoClaim: vi.fn(async () => ({
      nextId: '0-0',
      messages: [],
      deletedMessages: [],
    })),
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

  it('acknowledges a processed message', async () => {
    const client = createRedisClient();
    const eventBus = new RedisEventBus(client);

    await expect(
      eventBus.acknowledge('box-score', '1710000000000-0'),
    ).resolves.toBe(true);
    expect(client.xAck).toHaveBeenCalledWith(
      'game-events',
      'box-score',
      '1710000000000-0',
    );

    vi.mocked(client.xAck).mockResolvedValueOnce(0);
    await expect(
      eventBus.acknowledge('box-score', 'missing-message'),
    ).resolves.toBe(false);
  });

  it('claims and validates messages abandoned by another consumer', async () => {
    const client = createRedisClient();
    vi.mocked(client.xAutoClaim).mockResolvedValueOnce({
      nextId: '0-0',
      messages: [
        null,
        {
          id: '1710000000000-0',
          message: { event: JSON.stringify(gameEvent) },
        },
      ],
      deletedMessages: [],
    });
    const eventBus = new RedisEventBus(client);

    await expect(
      eventBus.claimPending({
        consumerGroup: 'box-score',
        consumerName: 'worker-2',
        minIdleTimeMs: 30_000,
        count: 5,
      }),
    ).resolves.toEqual([{ messageId: '1710000000000-0', event: gameEvent }]);
    expect(client.xAutoClaim).toHaveBeenCalledWith(
      'game-events',
      'box-score',
      'worker-2',
      30_000,
      '0-0',
      { COUNT: 5 },
    );
  });

  it('preserves failed messages in a dead-letter stream', async () => {
    const client = createRedisClient();
    const eventBus = new RedisEventBus(client, 'test-events');

    await expect(
      eventBus.deadLetter({
        consumerGroup: 'game-state',
        message: { messageId: '1710000000000-0', event: gameEvent },
        reason: 'database unavailable',
        attempts: 3,
      }),
    ).resolves.toBe('1710000000000-0');
    expect(client.xAdd).toHaveBeenCalledWith('test-events:dead-letter', '*', {
      sourceMessageId: '1710000000000-0',
      consumerGroup: 'game-state',
      attempts: '3',
      reason: 'database unavailable',
      event: JSON.stringify(gameEvent),
    });
  });

  it('closes an open client', async () => {
    const client = createRedisClient();
    const eventBus = new RedisEventBus(client);

    await eventBus.close();

    expect(client.close).toHaveBeenCalledOnce();
  });

  it('reports whether the Redis connection is ready', () => {
    const client = createRedisClient();
    const eventBus = new RedisEventBus(client);

    expect(eventBus.isReady()).toBe(true);
  });
});
