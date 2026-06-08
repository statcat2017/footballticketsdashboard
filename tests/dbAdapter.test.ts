import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { createSqliteAppDatabase } from "@/lib/db/adapter";

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
