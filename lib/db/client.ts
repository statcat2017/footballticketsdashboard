import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Database as SqliteDatabase } from "better-sqlite3";

import { createSqliteAppDatabase, type AppDatabase, type D1RootDatabaseLike } from "./adapter.ts";
import { createD1Database } from "./d1.ts";
import { defaultDatabasePath, setupDatabase } from "./setup.ts";

let database: AppDatabase | null = null;

export function createDatabase(filename = ":memory:"): SqliteDatabase {
  return setupDatabase(filename);
}

export function createAppDatabase(filename = ":memory:"): AppDatabase {
  return createSqliteAppDatabase(createDatabase(filename));
}

export async function getDatabase(): Promise<AppDatabase> {
  const cloudflareDatabase = await getCloudflareDatabase();

  if (cloudflareDatabase) {
    return cloudflareDatabase;
  }

  // Safe singleton: createAppDatabase() / new Database() is synchronous with
  // no inner await, so the null check and assignment run in one microtask tick.
  // Two concurrent requests that both pass the await above will still serialise
  // their continuations — the first assigns `database`, the second sees it set.
  if (!database) {
    try {
      const configuredPath = process.env.SQLITE_DB_PATH;
      const filename = configuredPath ?? defaultDatabasePath;
      database = createAppDatabase(filename);
    } catch (err) {
      console.error("Failed to create SQLite database:", err);
      throw err;
    }
  }

  return database;
}

async function getCloudflareDatabase(): Promise<AppDatabase | null> {
  try {
    const context = await getCloudflareContext({ async: true });
    const binding = (context.env as { DB?: D1RootDatabaseLike }).DB;

    if (!binding) {
      return null;
    }

    return createD1Database(binding);
  } catch {
    return null;
  }
}
