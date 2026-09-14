import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { connectRedisEventBus, type RedisEventBus } from '../../src/index.js';
import { gameEvent } from '../fixtures.js';

const redisUrl = process.env.TEST_REDIS_URL;
const describeWithRedis = redisUrl ? describe : describe.skip;

describeWithRedis('Redis event bus', () => {
  if (!redisUrl) {
    return;
  }

  const streamKey = `game-events:integration:${Date.now()}`;
  const errors: Error[] = [];
  let producer: RedisEventBus;
  let consumer: RedisEventBus;

  beforeAll(async () => {
    producer = await connectRedisEventBus({
      url: redisUrl,
      streamKey,
      onError: (error) => errors.push(error),
    });
    consumer = await connectRedisEventBus({
      url: redisUrl,
      streamKey,
      onError: (error) => errors.push(error),
    });
    await consumer.ensureConsumerGroup('integration-workers');
  });

  afterAll(async () => {
    await Promise.all([producer.close(), consumer.close()]);
  });

  it('exchanges and acknowledges an event', async () => {
    const messageId = await producer.publish(gameEvent);
    const messages = await consumer.read({
      consumerGroup: 'integration-workers',
      consumerName: 'worker-1',
      blockMs: 1_000,
    });

    expect(messages).toEqual([{ messageId, event: gameEvent }]);
    await expect(
      consumer.acknowledge('integration-workers', messageId),
    ).resolves.toBe(true);
    expect(errors).toEqual([]);
  });

  it('moves an abandoned pending event to another consumer', async () => {
    const messageId = await producer.publish(gameEvent);
    await consumer.read({
      consumerGroup: 'integration-workers',
      consumerName: 'worker-1',
      blockMs: 1_000,
    });

    await expect(
      consumer.claimPending({
        consumerGroup: 'integration-workers',
        consumerName: 'worker-2',
        minIdleTimeMs: 0,
      }),
    ).resolves.toEqual([{ messageId, event: gameEvent }]);
    await expect(
      consumer.acknowledge('integration-workers', messageId),
    ).resolves.toBe(true);
    expect(errors).toEqual([]);
  });
});
