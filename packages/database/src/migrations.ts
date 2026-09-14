import { readdir, readFile } from 'node:fs/promises';

const defaultMigrationsDirectory = new URL('../migrations/', import.meta.url);
const migrationLockName = 'nba-event-platform:migrations';

export interface Migration {
  name: string;
  sql: string;
}

export interface MigrationQueryResult {
  rowCount: number | null;
}

export interface MigrationClient {
  query(sql: string, parameters?: unknown[]): Promise<MigrationQueryResult>;
  release(): void;
}

export interface MigrationPool {
  connect(): Promise<MigrationClient>;
}

export interface RunMigrationsOptions {
  directory?: URL;
  migrations?: readonly Migration[];
}

export async function loadMigrations(
  directory = defaultMigrationsDirectory,
): Promise<Migration[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    names.map(async (name) => ({
      name,
      sql: await readFile(new URL(name, directory), 'utf8'),
    })),
  );
}

export async function runMigrations(
  pool: MigrationPool,
  options: RunMigrationsOptions = {},
): Promise<void> {
  const migrations =
    options.migrations ??
    (await loadMigrations(options.directory ?? defaultMigrationsDirectory));
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      migrationLockName,
    ]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const migration of migrations) {
      const applied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1',
        [migration.name],
      );

      if (applied.rowCount === 0) {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
          migration.name,
        ]);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
