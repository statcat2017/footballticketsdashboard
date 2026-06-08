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
  transaction<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T>;
}

export function createSqliteAppDatabase(db: SqliteDatabase): AppDatabase {
  const appDb: AppDatabase = {
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
    },
    async transaction<T>(fn: (txDb: AppDatabase) => Promise<T>): Promise<T> {
      db.exec("BEGIN");
      try {
        const result = await fn(appDb);
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  };

  return appDb;
}
