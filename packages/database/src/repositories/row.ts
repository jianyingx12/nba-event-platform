export function requireRow(
  value: unknown,
  table: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`database returned an invalid ${table} row`);
  }

  return value as Record<string, unknown>;
}
