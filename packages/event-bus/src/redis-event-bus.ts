import { gameEventSchema, type GameEvent } from '@nba-event-platform/schemas';
import { createClient } from 'redis';

import type {
  ClaimPendingEventsOptions,
  EventBus,
  EventBusMessage,
  ReadEventsOptions,
} from './event-bus.js';

interface RedisStreamMessage {
  id: string;
  message: Record<string, string>;
}

export interface RedisStreamsClient {
  readonly isOpen: boolean;
  connect(): Promise<unknown>;
  close(): Promise<unknown>;
  on(event: 'error', listener: (error: Error) => void): unknown;
  xAdd(
    key: string,
    id: string,
    message: Record<string, string>,
  ): Promise<string>;
  xAck(key: string, group: string, id: string): Promise<number>;
  xAutoClaim(
    key: string,
    group: string,
    consumer: string,
    minIdleTime: number,
    start: string,
    options: { COUNT: number },
  ): Promise<{
    nextId: string;
    messages: Array<RedisStreamMessage | null>;
    deletedMessages: string[];
  }>;
  xGroupCreate(
    key: string,
    group: string,
    id: string,
    options: { MKSTREAM: boolean },
  ): Promise<string>;
  xReadGroup(
    group: string,
    consumer: string,
    stream: { key: string; id: string },
    options: { COUNT: number; BLOCK: number },
  ): Promise<Array<{ name: string; messages: RedisStreamMessage[] }> | null>;
}

export interface RedisEventBusOptions {
  url: string;
  onError: (error: Error) => void;
  streamKey?: string;
}

export class RedisEventBus implements EventBus {
  constructor(
    private readonly client: RedisStreamsClient,
    private readonly streamKey = 'game-events',
  ) {}

  async publish(event: GameEvent): Promise<string> {
    const value = gameEventSchema.parse(event);

    return this.client.xAdd(this.streamKey, '*', {
      event: JSON.stringify(value),
    });
  }

  async ensureConsumerGroup(consumerGroup: string): Promise<void> {
    try {
      await this.client.xGroupCreate(this.streamKey, consumerGroup, '0', {
        MKSTREAM: true,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('BUSYGROUP')) {
        return;
      }

      throw error;
    }
  }

  async read(options: ReadEventsOptions): Promise<EventBusMessage[]> {
    const streams = await this.client.xReadGroup(
      options.consumerGroup,
      options.consumerName,
      { key: this.streamKey, id: '>' },
      {
        COUNT: options.count ?? 10,
        BLOCK: options.blockMs ?? 5_000,
      },
    );

    return (streams ?? []).flatMap((stream) =>
      stream.messages.map((message) => ({
        messageId: message.id,
        event: gameEventSchema.parse(JSON.parse(message.message.event ?? '')),
      })),
    );
  }

  async acknowledge(
    consumerGroup: string,
    messageId: string,
  ): Promise<boolean> {
    const acknowledged = await this.client.xAck(
      this.streamKey,
      consumerGroup,
      messageId,
    );

    return acknowledged > 0;
  }

  async claimPending(
    options: ClaimPendingEventsOptions,
  ): Promise<EventBusMessage[]> {
    const result = await this.client.xAutoClaim(
      this.streamKey,
      options.consumerGroup,
      options.consumerName,
      options.minIdleTimeMs,
      '0-0',
      { COUNT: options.count ?? 10 },
    );

    return result.messages.flatMap((message) =>
      message === null
        ? []
        : [
            {
              messageId: message.id,
              event: gameEventSchema.parse(
                JSON.parse(message.message.event ?? ''),
              ),
            },
          ],
    );
  }

  async close(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.close();
    }
  }
}

export async function connectRedisEventBus(
  options: RedisEventBusOptions,
): Promise<RedisEventBus> {
  const client: RedisStreamsClient = createClient({ url: options.url });
  client.on('error', options.onError);
  await client.connect();

  return new RedisEventBus(client, options.streamKey);
}
