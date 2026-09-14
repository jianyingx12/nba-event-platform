import { describe, expect, it, vi } from 'vitest';

import {
  loadMigrations,
  runMigrations,
  type MigrationClient,
  type MigrationPool,
} from '../src/index.js';

function createMigrationDatabase(applied = false): {
  client: MigrationClient;
  pool: MigrationPool;
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
} {
  const query = vi.fn(async (sql: string) => ({
    rowCount: sql.startsWith('SELECT 1 FROM schema_migrations')
      ? applied
        ? 1
        : 0
      : null,
  }));
  const release = vi.fn();
  const client = { query, release };
  const pool = { connect: vi.fn(async () => client) };

  return { client, pool, query, release };
}

describe('database migrations', () => {
  it('loads the initial schema migration', async () => {
    const migrations = await loadMigrations();

    expect(migrations.map((migration) => migration.name)).toEqual([
      '001_initial_schema.sql',
    ]);
    expect(migrations[0]?.sql).toContain('CREATE TABLE games');
    expect(migrations[0]?.sql).toContain('CREATE TABLE game_events');
    expect(migrations[0]?.sql).toContain('CREATE TABLE processed_events');
    expect(migrations[0]?.sql).toContain('CREATE TABLE game_state');
    expect(migrations[0]?.sql).toContain('CREATE TABLE player_game_stats');
  });

  it('applies an unapplied migration inside a transaction', async () => {
    const { pool, query, release } = createMigrationDatabase();

    await runMigrations(pool, {
      migrations: [{ name: '001_test.sql', sql: 'SELECT 42' }],
    });

    expect(query).toHaveBeenCalledWith('BEGIN');
    expect(query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['nba-event-platform:migrations'],
    );
    expect(query).toHaveBeenCalledWith('SELECT 42');
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });

  it('skips a migration that is already recorded', async () => {
    const { pool, query } = createMigrationDatabase(true);

    await runMigrations(pool, {
      migrations: [{ name: '001_test.sql', sql: 'SELECT 42' }],
    });

    expect(query).not.toHaveBeenCalledWith('SELECT 42');
    expect(query).toHaveBeenCalledWith('COMMIT');
  });
});
