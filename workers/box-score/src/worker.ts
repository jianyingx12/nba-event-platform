import type { PlayerGameStatsRepository } from '@nba-event-platform/database';
import type { EventBus, EventBusMessage } from '@nba-event-platform/event-bus';

import { applyPlayerGameEvent, createInitialPlayerGameStats } from './stats.js';

export interface BoxScoreWorkerDependencies {
  eventBus: Pick<
    EventBus,
    'acknowledge' | 'claimPending' | 'ensureConsumerGroup' | 'read'
  >;
  stats: Pick<PlayerGameStatsRepository, 'find' | 'save'>;
}

export interface BoxScoreWorkerOptions {
  consumerName: string;
  consumerGroup?: string;
  batchSize?: number;
  blockMs?: number;
  claimIdleMs?: number;
}

export class BoxScoreWorker {
  private readonly consumerGroup: string;
  private initialized = false;

  constructor(
    private readonly dependencies: BoxScoreWorkerDependencies,
    private readonly options: BoxScoreWorkerOptions,
  ) {
    this.consumerGroup = options.consumerGroup ?? 'box-score';
  }

  async processNextBatch(): Promise<number> {
    await this.ensureInitialized();

    const count = this.options.batchSize ?? 10;
    const recoveredMessages = await this.dependencies.eventBus.claimPending({
      consumerGroup: this.consumerGroup,
      consumerName: this.options.consumerName,
      minIdleTimeMs: this.options.claimIdleMs ?? 30_000,
      count,
    });
    const messages =
      recoveredMessages.length > 0
        ? recoveredMessages
        : await this.dependencies.eventBus.read({
            consumerGroup: this.consumerGroup,
            consumerName: this.options.consumerName,
            count,
            blockMs: this.options.blockMs ?? 5_000,
          });

    for (const message of messages) {
      await this.processMessage(message);
    }

    return messages.length;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.dependencies.eventBus.ensureConsumerGroup(this.consumerGroup);
      this.initialized = true;
    }
  }

  private async processMessage(message: EventBusMessage): Promise<void> {
    const playerId = message.event.playerId;

    if (playerId !== undefined) {
      const current =
        (await this.dependencies.stats.find(message.event.gameId, playerId)) ??
        createInitialPlayerGameStats(message.event.gameId, playerId);

      if (message.event.sequence === current.lastProcessedSequence) {
        await this.acknowledgeMessage(message);
        return;
      }

      const next = applyPlayerGameEvent(current, message.event);

      await this.dependencies.stats.save(next);
    }

    await this.acknowledgeMessage(message);
  }

  private async acknowledgeMessage(message: EventBusMessage): Promise<void> {
    const acknowledged = await this.dependencies.eventBus.acknowledge(
      this.consumerGroup,
      message.messageId,
    );

    if (!acknowledged) {
      throw new Error(`message ${message.messageId} was not acknowledged`);
    }
  }
}
