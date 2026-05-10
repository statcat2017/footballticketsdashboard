import type { Database as SqliteDatabase } from "better-sqlite3";
import type { CorrectionInput } from "@/lib/types";

export function createCorrection(db: SqliteDatabase, input: CorrectionInput): { id: number } {
  const result = db.prepare(`
    INSERT INTO corrections (fixture_id, club_name, email, price_text, source_url, message)
    VALUES (@fixtureId, @clubName, @email, @priceText, @sourceUrl, @message)
  `).run({
    fixtureId: input.fixtureId ?? null,
    clubName: input.clubName ?? null,
    email: input.email ?? null,
    priceText: input.priceText,
    sourceUrl: input.sourceUrl ?? null,
    message: input.message ?? null
  });

  return { id: Number(result.lastInsertRowid) };
}
