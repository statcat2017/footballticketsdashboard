import Database from "better-sqlite3";

const filename = process.env.SQLITE_DB_PATH;
if (!filename) {
  throw new Error("SQLITE_DB_PATH must point to the isolated runtime smoke database.");
}

const db = new Database(filename, { readonly: true });
try {
  const integrity = db.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") {
    throw new Error(`SQLite integrity check failed: ${integrity}`);
  }

  const { count } = db.prepare("SELECT COUNT(*) AS count FROM clubs").get();
  if (count < 1) {
    throw new Error("The reopened SQLite file has no clubs after the import smoke workflow.");
  }

  console.log(`SQLite reopen smoke passed (${count} clubs).`);
} finally {
  db.close();
}
