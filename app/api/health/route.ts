import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";

export async function GET() {
  const dbPath = process.env.SQLITE_DB_PATH;
  if (!dbPath) {
    return NextResponse.json(
      { ok: false, db: false },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  let db: SqliteDatabase | undefined;

  try {
    db = new Database(dbPath, { readonly: true });
    db.prepare("SELECT 1").get();

    return NextResponse.json(
      { ok: true, db: true, timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, db: false },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  } finally {
    db?.close();
  }
}
