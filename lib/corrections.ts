import type { AppDatabase } from "@/lib/db/adapter";
import type { CorrectionInput } from "@/lib/types";

export async function createCorrection(db: AppDatabase, input: CorrectionInput): Promise<{ id: number }> {
  const result = await db.run(`
    INSERT INTO corrections (fixture_id, club_name, email, price_text, source_url, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    input.fixtureId ?? null,
    input.clubName ?? null,
    input.email ?? null,
    input.priceText,
    input.sourceUrl ?? null,
    input.message ?? null
  ]);

  return { id: Number(result.lastInsertRowid ?? 0) };
}
