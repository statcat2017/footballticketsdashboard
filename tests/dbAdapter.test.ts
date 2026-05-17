import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { createD1AppDatabase, createSqliteAppDatabase, type D1RootDatabaseLike, type D1PreparedStatement, type D1TransactionLike } from "@/lib/db/adapter";

describe("database adapter writeBatch", () => {
  it("commits all SQLite writes when the batch succeeds", async () => {
    const sqlite = new Database(":memory:");
    const db = createSqliteAppDatabase(sqlite);

    await db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)");
    const results = await db.writeBatch([
      { sql: "INSERT INTO items (name) VALUES (?)", params: ["first"] },
      { sql: "INSERT INTO items (name) VALUES (?)", params: ["second"] }
    ]);

    await expect(db.all<{ name: string }>("SELECT name FROM items ORDER BY id")).resolves.toEqual([
      { name: "first" },
      { name: "second" }
    ]);
    expect(results).toHaveLength(2);
  });

  it("rolls back all SQLite writes when one batch statement fails", async () => {
    const sqlite = new Database(":memory:");
    const db = createSqliteAppDatabase(sqlite);

    await db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)");
    await expect(db.writeBatch([
      { sql: "INSERT INTO items (name) VALUES (?)", params: ["first"] },
      { sql: "INSERT INTO items (name) VALUES (?)", params: ["first"] }
    ])).rejects.toThrow();

    await expect(db.all("SELECT * FROM items")).resolves.toEqual([]);
  });

  it("uses D1 batch for D1 writes", async () => {
    const operations: string[] = [];
    const binding: D1RootDatabaseLike = {
      prepare(query: string) {
        operations.push(`prepare:${query}`);
        const statement = {
          bind(...values: Array<string | number | null>) {
            operations.push(`bind:${values.join(",")}`);
            return statement;
          },
          async all<T>() {
            return { results: [] as T[] };
          },
          async first<T>() {
            return null as T | null;
          },
          async run() {
            return { success: true, meta: { changes: 1, last_row_id: 10 } };
          }
        };
        return statement;
      },
      async exec() {
        return undefined;
      },
      async batch(statements: D1PreparedStatement[]) {
        operations.push(`batch:${statements.length}`);
        return statements.map((_, index) => ({ success: true, meta: { changes: 1, last_row_id: index + 1 } }));
      },
      async transaction<T>(callback: (txn: D1TransactionLike) => Promise<T>): Promise<T> {
        return callback(this);
      }
    };

    const db = createD1AppDatabase(binding);
    const results = await db.writeBatch([
      { sql: "INSERT INTO items (name) VALUES (?)", params: ["first"] },
      { sql: "INSERT INTO items (name) VALUES (?)", params: ["second"] }
    ]);

    expect(operations).toEqual([
      "prepare:INSERT INTO items (name) VALUES (?)",
      "bind:first",
      "prepare:INSERT INTO items (name) VALUES (?)",
      "bind:second",
      "batch:2"
    ]);
    expect(results).toEqual([
      { lastInsertRowid: 1, changes: 1 },
      { lastInsertRowid: 2, changes: 1 }
    ]);
  });

  it("throws when a D1 batch result reports failure", async () => {
    const binding: D1RootDatabaseLike = {
      prepare() {
        const statement = {
          bind() {
            return statement;
          },
          async all<T>() {
            return { results: [] as T[] };
          },
          async first<T>() {
            return null as T | null;
          },
          async run() {
            return { success: true };
          }
        };
        return statement;
      },
      async exec() {
        return undefined;
      },
      async batch() {
        return [{ success: true }, { success: false }];
      },
      async transaction<T>(callback: (txn: D1TransactionLike) => Promise<T>): Promise<T> {
        return callback(this);
      }
    };

    const db = createD1AppDatabase(binding);

    await expect(db.writeBatch([
      { sql: "INSERT INTO items (name) VALUES (?)", params: ["first"] },
      { sql: "INSERT INTO items (name) VALUES (?)", params: ["second"] }
    ])).rejects.toThrow("D1 batch statement 2 failed.");
  });
});

describe("database adapter transaction", () => {
  it("commits all SQLite writes when the callback succeeds", async () => {
    const sqlite = new Database(":memory:");
    const db = createSqliteAppDatabase(sqlite);

    await db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");

    const result = await db.transaction(async (tx) => {
      await tx.run("INSERT INTO items (name) VALUES (?)", ["first"]);
      await tx.run("INSERT INTO items (name) VALUES (?)", ["second"]);
      return "ok";
    });

    expect(result).toBe("ok");
    await expect(db.all<{ name: string }>("SELECT name FROM items ORDER BY id")).resolves.toEqual([
      { name: "first" },
      { name: "second" }
    ]);
  });

  it("rolls back all SQLite writes when the callback throws", async () => {
    const sqlite = new Database(":memory:");
    const db = createSqliteAppDatabase(sqlite);

    await db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");

    await expect(db.transaction(async (tx) => {
      await tx.run("INSERT INTO items (name) VALUES (?)", ["first"]);
      throw new Error("boom");
    })).rejects.toThrow("boom");

    await expect(db.all("SELECT * FROM items")).resolves.toEqual([]);
  });

  it("rolls back SQLite writes when an awaited operation inside the callback fails", async () => {
    const sqlite = new Database(":memory:");
    const db = createSqliteAppDatabase(sqlite);

    await db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)");

    await expect(db.transaction(async (tx) => {
      await tx.run("INSERT INTO items (name) VALUES (?)", ["first"]);
      await tx.run("INSERT INTO items (name) VALUES (?)", ["first"]);
    })).rejects.toThrow();

    await expect(db.all("SELECT * FROM items")).resolves.toEqual([]);
  });
});
