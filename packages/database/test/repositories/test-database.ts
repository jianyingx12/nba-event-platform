import { vi } from 'vitest';

import type { DatabaseQueryResult, Queryable } from '../../src/index.js';

export function createTestDatabase(result: DatabaseQueryResult): {
  database: Queryable;
  query: ReturnType<typeof vi.fn>;
} {
  const query = vi.fn(async (sql: string, parameters?: unknown[]) => {
    void sql;
    void parameters;
    return result;
  });

  return {
    database: { query },
    query,
  };
}
