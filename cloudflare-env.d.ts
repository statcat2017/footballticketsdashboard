interface D1ResultMeta {
  last_row_id?: number;
  changes?: number;
}

interface D1PreparedStatement {
  bind(...values: Array<string | number | null>): D1PreparedStatement;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: D1ResultMeta }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
}

interface CloudflareEnv {
  DB: D1Database;
  OPENROUTESERVICE_API_KEY?: string;
  TRAVELTIME_APP_ID?: string;
  TRAVELTIME_API_KEY?: string;
}
