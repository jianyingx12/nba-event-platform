import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import { createDatabasePool, type MigrationPool } from '../src/index.js';

describe('createDatabasePool', () => {
  it('creates a lazy PostgreSQL pool with the supplied options', async () => {
    const pool = createDatabasePool({
      connectionString: 'postgresql://user:password@localhost:5432/nba',
      applicationName: 'database-test',
      maxConnections: 5,
      connectionTimeoutMs: 2_000,
      idleTimeoutMs: 10_000,
      ssl: false,
    });
    const migrationPool: MigrationPool = pool;

    expect(pool).toBeInstanceOf(Pool);
    expect(migrationPool).toBe(pool);
    expect(pool.options).toMatchObject({
      connectionString: 'postgresql://user:password@localhost:5432/nba',
      application_name: 'database-test',
      max: 5,
      connectionTimeoutMillis: 2_000,
      idleTimeoutMillis: 10_000,
      ssl: false,
    });

    await pool.end();
  });
});
