import type { Queryable } from './queryable.js';

const markProcessedSql = `
  INSERT INTO processed_events (consumer, event_id)
  VALUES ($1, $2)
  ON CONFLICT DO NOTHING
  RETURNING event_id
`;

const hasProcessedSql = `
  SELECT 1 FROM processed_events WHERE consumer = $1 AND event_id = $2
`;

export class ProcessedEventRepository {
  constructor(private readonly database: Queryable) {}

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const result = await this.database.query(markProcessedSql, [
      consumer,
      eventId,
    ]);

    return result.rowCount === 1;
  }

  async hasProcessed(consumer: string, eventId: string): Promise<boolean> {
    const result = await this.database.query(hasProcessedSql, [
      consumer,
      eventId,
    ]);

    return result.rowCount === 1;
  }
}
