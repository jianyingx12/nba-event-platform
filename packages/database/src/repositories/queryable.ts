export interface DatabaseQueryResult {
  rowCount: number | null;
  rows: unknown[];
}

export interface Queryable {
  query(sql: string, parameters?: unknown[]): Promise<DatabaseQueryResult>;
}
