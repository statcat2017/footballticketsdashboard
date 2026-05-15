import type { Database as SqliteDatabase } from "better-sqlite3";

export type QueryParam = string | number | null;

export interface SqlWrite {
  sql: string;
  params?: QueryParam[];
}

export interface WriteResult {
  lastInsertRowid?: number;
  changes: number;
}

export interface AppDatabase {
  all<T>(sql: string, params?: QueryParam[]): Promise<T[]>;
  get<T>(sql: string, params?: QueryParam[]): Promise<T | undefined>;
  run(sql: string, params?: QueryParam[]): Promise<WriteResult>;
  exec(sql: string): Promise<void>;
  writeBatch(statements: SqlWrite[]): Promise<WriteResult[]>;
}

export interface D1ResultRow {
  success: boolean;
  meta?: {
    last_row_id?: number;
    changes?: number;
  };
}

export interface D1PreparedStatement {
  bind(...values: QueryParam[]): D1PreparedStatement;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<D1ResultRow>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
  batch(statements: D1PreparedStatement[]): Promise<D1ResultRow[]>;
}

export function createSqliteAppDatabase(db: SqliteDatabase): AppDatabase {
  return {
    async all<T>(sql: string, params: QueryParam[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async get<T>(sql: string, params: QueryParam[] = []) {
      return db.prepare(sql).get(...params) as T | undefined;
    },
    async run(sql: string, params: QueryParam[] = []) {
      const result = db.prepare(sql).run(...params);
      return {
        lastInsertRowid: Number(result.lastInsertRowid),
        changes: result.changes
      };
    },
    async exec(sql: string) {
      db.exec(sql);
    },
    async writeBatch(statements: SqlWrite[]) {
      if (statements.length === 0) {
        return [];
      }

      db.exec("BEGIN");
      const results: WriteResult[] = [];

      try {
        for (const statement of statements) {
          const result = db.prepare(statement.sql).run(...(statement.params ?? []));
          results.push({
            lastInsertRowid: Number(result.lastInsertRowid),
            changes: result.changes
          });
        }

        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  };
}

export function createD1AppDatabase(db: D1DatabaseLike): AppDatabase {
  return {
    async all<T>(sql: string, params: QueryParam[] = []) {
      const result = await db.prepare(sql).bind(...params).all<T>();
      return result.results;
    },
    async get<T>(sql: string, params: QueryParam[] = []) {
      const result = await db.prepare(sql).bind(...params).first<T>();
      return result ?? undefined;
    },
    async run(sql: string, params: QueryParam[] = []) {
      const result = await db.prepare(sql).bind(...params).run();
      return {
        lastInsertRowid: result.meta?.last_row_id,
        changes: result.meta?.changes ?? 0
      };
    },
    async exec(sql: string) {
      await db.exec(sql);
    },
    async writeBatch(statements: SqlWrite[]) {
      if (statements.length === 0) {
        return [];
      }

      const prepared = statements.map((statement) => db.prepare(statement.sql).bind(...(statement.params ?? [])));
      const results = await db.batch(prepared);

      const failedIndex = results.findIndex((result) => !result.success);

      if (failedIndex !== -1) {
        throw new Error(`D1 batch statement ${failedIndex + 1} failed.`);
      }

      return results.map((result) => ({
        lastInsertRowid: result.meta?.last_row_id,
        changes: result.meta?.changes ?? 0
      }));
    }
  };
}
