import { NextResponse } from "next/server";
import Database from "better-sqlite3";

export async function GET() {
  const dbPath = process.env.SQLITE_DB_PATH;
  if (!dbPath) {
    return NextResponse.json({ ok: false, error: "SQLITE_DB_PATH not set" }, { status: 503 });
  }

  try {
    const db = new Database(dbPath, { readonly: true });
    db.pragma("journal_mode = WAL");
    db.prepare("SELECT 1").get();
    db.close();

    return NextResponse.json({
      ok: true,
      db: true,
      version: process.env.npm_package_version ?? "unknown",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: false, error: String(err) },
      { status: 503 }
    );
  }
}
