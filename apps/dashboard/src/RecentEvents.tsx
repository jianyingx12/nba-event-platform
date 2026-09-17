import type { GameEvent } from '@nba-event-platform/schemas';

interface RecentEventsProps {
  events: GameEvent[];
}

function formatEventType(eventType: GameEvent['eventType']) {
  return eventType.replaceAll('_', ' ');
}

export function RecentEvents({ events }: RecentEventsProps) {
  return (
    <section className="event-feed" aria-labelledby="event-feed-heading">
      <header className="section-heading">
        <div>
          <p>Newest first</p>
          <h2 id="event-feed-heading">Recent events</h2>
        </div>
        <span>{events.length} shown</span>
      </header>

      {events.length > 0 ? (
        <ol className="event-feed__list">
          {events.map((event) => (
            <li key={event.eventId} className="event-feed__item">
              <div className="event-feed__sequence">#{event.sequence}</div>
              <div className="event-feed__play">
                <div className="event-feed__context">
                  <span>
                    Q{event.period} · {event.clock}
                  </span>
                  <span className="event-feed__type">
                    {formatEventType(event.eventType)}
                  </span>
                </div>
                <p>{event.description}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="event-feed__empty">No events have been recorded.</p>
      )}
    </section>
  );
}
