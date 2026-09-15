import type {
  GameRepository,
  GameStateRepository,
} from '@nba-event-platform/database';
import type { EventBus, EventBusMessage } from '@nba-event-platform/event-bus';

import { applyGameEvent, createInitialGameState } from './state.js';

export interface GameStateWorkerDependencies {
  eventBus: Pick<
    EventBus,
    | 'acknowledge'
    | 'claimPending'
    | 'deadLetter'
    | 'ensureConsumerGroup'
    | 'read'
  >;
  games: Pick<GameRepository, 'findById'>;
  states: Pick<GameStateRepository, 'findByGameId' | 'save'>;
}

export interface GameStateWorkerOptions {
  consumerName: string;
  consumerGroup?: string;
  batchSize?: number;
  blockMs?: number;
  claimIdleMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
}

export class GameStateWorker {
  private readonly consumerGroup: string;
  private initialized = false;

  constructor(
    private readonly dependencies: GameStateWorkerDependencies,
    private readonly options: GameStateWorkerOptions,
  ) {
    this.consumerGroup = options.consumerGroup ?? 'game-state';
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
      await this.processMessageWithRetries(message);
    }

    return messages.length;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.dependencies.eventBus.ensureConsumerGroup(this.consumerGroup);
      this.initialized = true;
    }
  }

  private async processMessageWithRetries(
    message: EventBusMessage,
  ): Promise<void> {
    const maxAttempts = Math.max(1, this.options.maxAttempts ?? 3);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.processMessage(message);
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          if (error instanceof AcknowledgementError) {
            throw error;
          }

          await this.dependencies.eventBus.deadLetter({
            consumerGroup: this.consumerGroup,
            message,
            reason: getErrorMessage(error),
            attempts: maxAttempts,
          });
          await this.acknowledgeMessage(message);
          return;
        }

        const retryDelayMs = this.options.retryDelayMs ?? 1_000;
        if (retryDelayMs > 0) {
          await delay(retryDelayMs);
        }
      }
    }
  }

  private async processMessage(message: EventBusMessage): Promise<void> {
    let state = await this.dependencies.states.findByGameId(
      message.event.gameId,
    );

    if (
      state !== null &&
      message.event.sequence === state.lastProcessedSequence
    ) {
      await this.acknowledgeMessage(message);
      return;
    }

    if (state === null) {
      const game = await this.dependencies.games.findById(message.event.gameId);

      if (game === null) {
        throw new Error(`game ${message.event.gameId} was not found`);
      }

      state = createInitialGameState(game);
    }

    const nextState = applyGameEvent(state, message.event);
    await this.dependencies.states.save(nextState);

    await this.acknowledgeMessage(message);
  }

  private async acknowledgeMessage(message: EventBusMessage): Promise<void> {
    const acknowledged = await this.dependencies.eventBus.acknowledge(
      this.consumerGroup,
      message.messageId,
    );

    if (!acknowledged) {
      throw new AcknowledgementError(message.messageId);
    }
  }
}

class AcknowledgementError extends Error {
  constructor(messageId: string) {
    super(`message ${messageId} was not acknowledged`);
    this.name = 'AcknowledgementError';
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
