import type { GameEvent } from '@nba-event-platform/schemas';

export interface EventBusMessage {
  messageId: string;
  event: GameEvent;
  deliveryCount?: number;
}

export interface ReadEventsOptions {
  consumerGroup: string;
  consumerName: string;
  count?: number;
  blockMs?: number;
}

export interface ClaimPendingEventsOptions {
  consumerGroup: string;
  consumerName: string;
  minIdleTimeMs: number;
  count?: number;
}

export interface EventBus {
  publish(event: GameEvent): Promise<string>;
  ensureConsumerGroup(consumerGroup: string): Promise<void>;
  read(options: ReadEventsOptions): Promise<EventBusMessage[]>;
  acknowledge(consumerGroup: string, messageId: string): Promise<boolean>;
  claimPending(options: ClaimPendingEventsOptions): Promise<EventBusMessage[]>;
  close(): Promise<void>;
}
