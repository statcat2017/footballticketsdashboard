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

export interface D1TransactionLike {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
}

export interface D1RootDatabaseLike extends D1TransactionLike {
  batch(statements: D1PreparedStatement[]): Promise<D1ResultRow[]>;
  transaction<T>(callback: (txn: D1TransactionLike) => Promise<T>): Promise<T>;
}

export type D1DatabaseLike = D1RootDatabaseLike;

function wrapD1(client: D1TransactionLike): AppDatabase {
  return {
    async all<T>(sql: string, params: QueryParam[] = []) {
      const result = await client.prepare(sql).bind(...params).all<T>();
      return result.results;
    },
    async get<T>(sql: string, params: QueryParam[] = []) {
      const result = await client.prepare(sql).bind(...params).first<T>();
      return result ?? undefined;
    },
    async run(sql: string, params: QueryParam[] = []) {
      const result = await client.prepare(sql).bind(...params).run();
      return {
        lastInsertRowid: result.meta?.last_row_id,
        changes: result.meta?.changes ?? 0
      };
    },
    async exec(sql: string) {
      await client.exec(sql);
    },
    async writeBatch(statements: SqlWrite[]) {
      if (statements.length === 0) {
        return [];
      }

      if ("batch" in client && typeof (client as D1RootDatabaseLike).batch === "function") {
        const d1 = client as D1RootDatabaseLike;
        const prepared = statements.map((s) => d1.prepare(s.sql).bind(...(s.params ?? [])));
        const results = await d1.batch(prepared);

        const failedIndex = results.findIndex((r) => !r.success);

        if (failedIndex !== -1) {
          throw new Error(`D1 batch statement ${failedIndex + 1} failed.`);
        }

        return results.map((r) => ({
          lastInsertRowid: r.meta?.last_row_id,
          changes: r.meta?.changes ?? 0
        }));
      }

      const results: WriteResult[] = [];
      for (const statement of statements) {
        const r = await client.prepare(statement.sql).bind(...(statement.params ?? [])).run();
        results.push({
          lastInsertRowid: r.meta?.last_row_id,
          changes: r.meta?.changes ?? 0
        });
      }
      return results;
    },
    async transaction<T>(fn: (txDb: AppDatabase) => Promise<T>): Promise<T> {
      if ("transaction" in client && typeof (client as D1RootDatabaseLike).transaction === "function") {
        const d1 = client as D1RootDatabaseLike;
        return d1.transaction(async (txn) => fn(wrapD1(txn)));
      }
      throw new Error("D1 transaction API is not available in this context.");
    }
  };
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

export function createD1AppDatabase(db: D1RootDatabaseLike): AppDatabase {
  return wrapD1(db);
}
