import type { EventBus } from '@nba-event-platform/event-bus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp, type EventStore } from '../src/index.js';
import { gameEvent } from './fixtures.js';

const apps = [] as ReturnType<typeof buildApp>[];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function createEventBus(): Pick<EventBus, 'publish'> {
  return {
    publish: vi.fn(async () => 'message-1'),
  };
}

function createEventStore(): EventStore {
  return {
    insert: vi.fn(async () => true),
  };
}

describe('POST /v1/events', () => {
  it('publishes a valid event', async () => {
    const eventBus = createEventBus();
    const eventStore = createEventStore();
    const app = buildApp({ eventBus, eventStore });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: gameEvent,
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      accepted: true,
      eventId: gameEvent.eventId,
    });
    expect(eventStore.insert).toHaveBeenCalledWith(gameEvent);
    expect(eventBus.publish).toHaveBeenCalledWith(gameEvent);
  });

  it('rejects an invalid event without publishing it', async () => {
    const eventBus = createEventBus();
    const eventStore = createEventStore();
    const app = buildApp({ eventBus, eventStore });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: { ...gameEvent, sequence: 0 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      accepted: false,
      reason: 'invalid_event',
    });
    expect(eventStore.insert).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('does not publish a duplicate event', async () => {
    const eventBus = createEventBus();
    const eventStore = createEventStore();
    vi.mocked(eventStore.insert).mockResolvedValueOnce(false);
    const app = buildApp({ eventBus, eventStore });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: gameEvent,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accepted: false,
      reason: 'duplicate_event',
    });
    expect(eventStore.insert).toHaveBeenCalledWith(gameEvent);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
