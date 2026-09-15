import type { GameEvent } from '@nba-event-platform/schemas';

import type { ReplayFixture } from './fixture.js';

export const REPLAY_SPEEDS = [1, 5, 10, 50, 'max'] as const;

export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

export interface EventIngestionClient {
  submit(event: GameEvent): Promise<void>;
}

export interface ReplayOptions {
  speed: ReplaySpeed;
  wait?: (milliseconds: number) => Promise<void>;
}

export async function replayFixture(
  fixture: ReplayFixture,
  ingestion: EventIngestionClient,
  options: ReplayOptions,
): Promise<number> {
  const wait = options.wait ?? delay;

  for (const [index, event] of fixture.events.entries()) {
    const previousEvent = fixture.events[index - 1];

    if (previousEvent && options.speed !== 'max') {
      const elapsed =
        Date.parse(event.occurredAt) - Date.parse(previousEvent.occurredAt);
      const replayDelay = Math.max(0, elapsed / options.speed);

      if (replayDelay > 0) {
        await wait(replayDelay);
      }
    }

    await ingestion.submit(event);
  }

  return fixture.events.length;
}

export function parseReplaySpeed(value: string): ReplaySpeed {
  if (value.toLowerCase() === 'max') {
    return 'max';
  }

  const speed = Number(value);
  if (speed === 1 || speed === 5 || speed === 10 || speed === 50) {
    return speed;
  }

  throw new Error('replay speed must be 1, 5, 10, 50, or max');
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
