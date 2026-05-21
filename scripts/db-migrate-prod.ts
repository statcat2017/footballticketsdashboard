import path from "node:path";
import Database from "better-sqlite3";
import { applyPendingMigrations } from "../lib/db/migrate.ts";

const dbPath = process.env.SQLITE_DB_PATH ?? path.join(process.cwd(), "data", "nearmefc.sqlite");
const migrationsDir = path.join(process.cwd(), "lib", "db", "migrations");

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

applyPendingMigrations(db, migrationsDir);

db.close();
console.log(`Migrations applied to ${dbPath}`);
