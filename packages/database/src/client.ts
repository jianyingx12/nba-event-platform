import { Pool } from 'pg';

export interface DatabasePoolOptions {
  connectionString: string;
  applicationName?: string;
  maxConnections?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
  ssl?: boolean;
}

export function createDatabasePool(options: DatabasePoolOptions): Pool {
  return new Pool({
    connectionString: options.connectionString,
    application_name: options.applicationName,
    max: options.maxConnections,
    connectionTimeoutMillis: options.connectionTimeoutMs,
    idleTimeoutMillis: options.idleTimeoutMs,
    ssl: options.ssl,
  });
}
