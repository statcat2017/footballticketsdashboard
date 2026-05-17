import type { AppDatabase } from "../db/adapter.ts";
import type { FixtureSource, FixtureSourceInput } from "./types.ts";

function mapSourceRow(row: Record<string, unknown>): FixtureSource {
  return {
    id: row.id as number,
    sourceType: row.source_type as FixtureSource["sourceType"],
    name: row.name as string,
    baseUrl: (row.base_url as string) ?? null,
    trustLevel: row.trust_level as FixtureSource["trustLevel"],
    autoApproval: (row.auto_approval as number) === 1,
    evidenceRequirements: (row.evidence_requirements as string) ?? null,
    lastSuccessAt: (row.last_success_at as string) ?? null,
    failureCount: row.failure_count as number,
    createdAt: row.created_at as string,
  };
}

export async function createSource(db: AppDatabase, input: FixtureSourceInput): Promise<FixtureSource> {
  const result = await db.run(
    `INSERT INTO fixture_sources (source_type, name, base_url, trust_level, auto_approval, evidence_requirements)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.sourceType,
      input.name,
      input.baseUrl ?? null,
      input.trustLevel ?? "untrusted",
      input.autoApproval ? 1 : 0,
      input.evidenceRequirements ?? null,
    ]
  );

  const row = await db.get<Record<string, unknown>>(
    `SELECT * FROM fixture_sources WHERE id = ?`,
    [result.lastInsertRowid ?? 0]
  );

  if (!row) {
    throw new Error("Failed to retrieve created fixture source.");
  }

  return mapSourceRow(row);
}

export async function listSources(db: AppDatabase): Promise<FixtureSource[]> {
  const rows = await db.all<Record<string, unknown>>(
    `SELECT * FROM fixture_sources ORDER BY created_at DESC`
  );
  return rows.map(mapSourceRow);
}

export async function getSource(db: AppDatabase, id: number): Promise<FixtureSource | undefined> {
  const row = await db.get<Record<string, unknown>>(
    `SELECT * FROM fixture_sources WHERE id = ?`,
    [id]
  );
  return row ? mapSourceRow(row) : undefined;
}

export async function updateSource(
  db: AppDatabase,
  id: number,
  updates: Partial<Omit<FixtureSourceInput, "sourceType">>
): Promise<FixtureSource> {
  const existing = await getSource(db, id);
  if (!existing) {
    throw new Error(`Fixture source ${id} not found.`);
  }

  const fields: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    params.push(updates.name);
  }
  if (updates.baseUrl !== undefined) {
    fields.push("base_url = ?");
    params.push(updates.baseUrl ?? null);
  }
  if (updates.trustLevel !== undefined) {
    fields.push("trust_level = ?");
    params.push(updates.trustLevel);
  }
  if (updates.autoApproval !== undefined) {
    fields.push("auto_approval = ?");
    params.push(updates.autoApproval ? 1 : 0);
  }
  if (updates.evidenceRequirements !== undefined) {
    fields.push("evidence_requirements = ?");
    params.push(updates.evidenceRequirements ?? null);
  }

  if (fields.length === 0) {
    return existing;
  }

  params.push(id);

  await db.run(
    `UPDATE fixture_sources SET ${fields.join(", ")} WHERE id = ?`,
    params
  );

  const updated = await getSource(db, id);
  if (!updated) {
    throw new Error(`Fixture source ${id} not found after update.`);
  }
  return updated;
}

export async function recordSuccess(db: AppDatabase, id: number): Promise<void> {
  await db.run(
    `UPDATE fixture_sources SET last_success_at = CURRENT_TIMESTAMP, failure_count = 0 WHERE id = ?`,
    [id]
  );
}

export async function recordFailure(db: AppDatabase, id: number): Promise<void> {
  await db.run(
    `UPDATE fixture_sources SET failure_count = failure_count + 1 WHERE id = ?`,
    [id]
  );
}
