export type SqlValue = string | number | null;

export function escapeSql(value: string): string {
  return value.replaceAll("'", "''");
}

export function escapeSqlValue(value: SqlValue): string {
  if (value === null) {
    return "NULL";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  return `'${value.replaceAll("'", "''")}'`;
}
