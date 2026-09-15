import type {
  GameRepository,
  GameStateRepository,
} from '@nba-event-platform/database';
import type { EventBus, EventBusMessage } from '@nba-event-platform/event-bus';

import { applyGameEvent, createInitialGameState } from './state.js';

export interface GameStateWorkerDependencies {
  eventBus: Pick<EventBus, 'acknowledge' | 'ensureConsumerGroup' | 'read'>;
  games: Pick<GameRepository, 'findById'>;
  states: Pick<GameStateRepository, 'findByGameId' | 'save'>;
}

export interface GameStateWorkerOptions {
  consumerName: string;
  consumerGroup?: string;
  batchSize?: number;
  blockMs?: number;
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

    const messages = await this.dependencies.eventBus.read({
      consumerGroup: this.consumerGroup,
      consumerName: this.options.consumerName,
      count: this.options.batchSize ?? 10,
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
      throw new Error(`message ${message.messageId} was not acknowledged`);
    }
  }
}
