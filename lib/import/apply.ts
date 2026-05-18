import type { AppDatabase, SqlWrite } from "../db/adapter.ts";
import type { ImportBatchRow } from "./types.ts";
import { getBatch, getBatchRows } from "./importBatch.ts";
import { buildAdminAuditLogWrite } from "../admin/audit.ts";

async function getCurrentSeasonLabel(db: AppDatabase): Promise<string | undefined> {
  const season = await db.get<{ label: string }>(
    `SELECT label FROM fixture_seasons WHERE is_current = 1 LIMIT 1`
  );
  return season?.label;
}

export interface ApplyResult {
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + "T00:00:00Z").getUTCDay();
  return day === 0 || day === 6;
}

function getAssumedKickoffTime(dateStr: string): string {
  return isWeekend(dateStr) ? "15:00" : "19:45";
}

export function buildFixtureInsert(row: ImportBatchRow, seasonLabel: string | null): SqlWrite {
  const source = "import_batch";
  const sourceId = `${row.batchId}-${row.id}`;

  const dateValue = row.kickoffDate;
  const timeValue = row.kickoffTime;

  const time = timeValue ?? (dateValue ? getAssumedKickoffTime(dateValue) : null);
  const kickoffAt = dateValue && time ? `${dateValue}T${time}:00.000Z` : null;
  const statusValue = row.status ?? "scheduled";
  const competitionCode = row.competitionResolvedCode ?? "";

  return {
    sql: `INSERT INTO fixtures (
      source, source_id, competition_code,
      home_club_id, away_club_id, venue_id,
      kickoff_at, fixture_date, kickoff_time, kickoff_time_status,
      season_label, status, is_demo_data, is_historical,
      home_one_off, away_one_off,
      home_one_off_name, away_one_off_name,
      confidence, source_url, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source, source_id) DO UPDATE SET
      competition_code = excluded.competition_code,
      home_club_id = excluded.home_club_id,
      away_club_id = excluded.away_club_id,
      venue_id = excluded.venue_id,
      kickoff_at = excluded.kickoff_at,
      fixture_date = excluded.fixture_date,
      kickoff_time = excluded.kickoff_time,
      kickoff_time_status = excluded.kickoff_time_status,
      season_label = excluded.season_label,
      status = excluded.status,
      home_one_off = excluded.home_one_off,
      away_one_off = excluded.away_one_off,
      home_one_off_name = excluded.home_one_off_name,
      away_one_off_name = excluded.away_one_off_name,
      confidence = excluded.confidence,
      source_url = excluded.source_url,
      source_updated_at = CURRENT_TIMESTAMP`,
    params: [
      source, sourceId, competitionCode,
      row.homeParticipantResolvedId,
      row.awayParticipantResolvedId,
      row.venueResolvedId,
      kickoffAt,
      dateValue,
      time,
      row.kickoffTime ? "confirmed" : (time ? "assumed" : "unknown"),
      seasonLabel,
      statusValue,
      row.homeIsOneOff ? 1 : 0,
      row.awayIsOneOff ? 1 : 0,
      row.homeIsOneOff ? row.homeParticipantRaw : null,
      row.awayIsOneOff ? row.awayParticipantRaw : null,
      "imported",
      row.sourceUrl ?? null,
    ],
  };
}

export function buildFixtureUpdate(row: ImportBatchRow, fixtureId: number): SqlWrite {
  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];

  if (row.competitionResolvedCode) {
    setClauses.push("competition_code = ?");
    params.push(row.competitionResolvedCode);
  }
  if (row.homeParticipantResolvedId !== null && row.homeParticipantResolvedId !== undefined) {
    setClauses.push("home_club_id = ?");
    params.push(row.homeParticipantResolvedId);
  }
  if (row.awayParticipantResolvedId !== null && row.awayParticipantResolvedId !== undefined) {
    setClauses.push("away_club_id = ?");
    params.push(row.awayParticipantResolvedId);
  }
  if (row.venueResolvedId && row.venueRaw) {
    setClauses.push("venue_id = ?");
    params.push(row.venueResolvedId);
  }
  if (row.kickoffDate) {
    setClauses.push("fixture_date = ?");
    params.push(row.kickoffDate);
    if (row.kickoffTime) {
      setClauses.push("kickoff_time = ?");
      params.push(row.kickoffTime);
      setClauses.push("kickoff_at = ?");
      params.push(`${row.kickoffDate}T${row.kickoffTime}:00.000Z`);
      setClauses.push("kickoff_time_status = ?");
      params.push("confirmed");
    }
  } else if (row.kickoffTime) {
    setClauses.push("kickoff_time = ?");
    params.push(row.kickoffTime);
    setClauses.push("kickoff_time_status = ?");
    params.push("confirmed");
  }
  if (row.status) {
    setClauses.push("status = ?");
    params.push(row.status);
  }
  if (row.homeIsOneOff !== undefined) {
    setClauses.push("home_one_off = ?");
    params.push(row.homeIsOneOff ? 1 : 0);
  }
  if (row.awayIsOneOff !== undefined) {
    setClauses.push("away_one_off = ?");
    params.push(row.awayIsOneOff ? 1 : 0);
  }
  if (row.homeIsOneOff && row.homeParticipantRaw) {
    setClauses.push("home_one_off_name = ?");
    params.push(row.homeParticipantRaw);
  }
  if (row.awayIsOneOff && row.awayParticipantRaw) {
    setClauses.push("away_one_off_name = ?");
    params.push(row.awayParticipantRaw);
  }
  if (row.sourceUrl) {
    setClauses.push("source_url = ?");
    params.push(row.sourceUrl);
  }
  setClauses.push("confidence = ?");
  params.push("imported");
  setClauses.push("source_updated_at = CURRENT_TIMESTAMP");
  setClauses.push("imported_at = CURRENT_TIMESTAMP");

  if (setClauses.length === 0) {
    return { sql: "SELECT 1", params: [] };
  }

  params.push(fixtureId);

  return {
    sql: `UPDATE fixtures SET ${setClauses.join(", ")} WHERE id = ?`,
    params,
  };
}

interface ExistingFixture {
  id: number;
  before: Record<string, unknown>;
}

export async function findExistingFixture(
  db: AppDatabase,
  row: ImportBatchRow,
  seasonLabel: string | null,
): Promise<ExistingFixture | null> {
  if (!row.competitionResolvedCode) return null;

  let fixtures: Record<string, unknown>[] = [];

  if (row.homeIsOneOff && row.awayIsOneOff) {
    fixtures = await db.all<Record<string, unknown>>(
      `SELECT * FROM fixtures
       WHERE competition_code = ? AND season_label = ?
       AND home_one_off_name = ? AND away_one_off_name = ?`,
      [row.competitionResolvedCode, seasonLabel, row.homeParticipantRaw, row.awayParticipantRaw]
    );
  } else if (row.homeIsOneOff && row.awayParticipantResolvedId) {
    fixtures = await db.all<Record<string, unknown>>(
      `SELECT * FROM fixtures
       WHERE competition_code = ? AND season_label = ?
       AND home_one_off_name = ? AND away_club_id = ?`,
      [row.competitionResolvedCode, seasonLabel, row.homeParticipantRaw, row.awayParticipantResolvedId]
    );
  } else if (row.awayIsOneOff && row.homeParticipantResolvedId) {
    fixtures = await db.all<Record<string, unknown>>(
      `SELECT * FROM fixtures
       WHERE competition_code = ? AND season_label = ?
       AND away_one_off_name = ? AND home_club_id = ?`,
      [row.competitionResolvedCode, seasonLabel, row.awayParticipantRaw, row.homeParticipantResolvedId]
    );
  } else if (row.homeParticipantResolvedId && row.awayParticipantResolvedId) {
    let sql = `SELECT * FROM fixtures
      WHERE home_club_id = ? AND away_club_id = ? AND competition_code = ? AND season_label = ?`;
    const params: (string | number | null)[] = [
      row.homeParticipantResolvedId,
      row.awayParticipantResolvedId,
      row.competitionResolvedCode,
      seasonLabel,
    ];
    if (row.kickoffDate) {
      sql += ` AND fixture_date = ?`;
      params.push(row.kickoffDate);
    }
    fixtures = await db.all<Record<string, unknown>>(sql, params);
  }

  if (fixtures.length === 0) return null;
  if (fixtures.length > 1) return null;

  const fixture = fixtures[0];

  const before: Record<string, unknown> = {};
  const fields = ["competition_code", "venue_id", "fixture_date", "kickoff_time", "kickoff_time_status", "status", "home_one_off", "away_one_off", "home_one_off_name", "away_one_off_name", "source_url"];
  for (const f of fields) {
    if (f in fixture) before[f] = fixture[f];
  }

  return {
    id: fixture.id as number,
    before,
  };
}

export async function applyBatchRows(
  db: AppDatabase,
  batchId: number,
  actor: string,
): Promise<ApplyResult> {
  const batch = await getBatch(db, batchId);
  if (!batch) throw new Error(`Import batch ${batchId} not found.`);

  if (batch.approvalStatus === "approved") {
    throw new Error(`Import batch ${batchId} has already been approved.`);
  }

  const activeRows = await db.all<{ id: number }>(
    `SELECT id FROM import_batch_rows WHERE batch_id = ? AND final_action IS NULL LIMIT 1`,
    [batchId]
  );
  if (activeRows.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, total: 0 };
  }

  const allRows = await getBatchRows(db, batchId);
  const activeRows2 = allRows.filter((r) => !r.finalAction);
  const grouped: Record<string, ImportBatchRow[]> = { insert: [], update: [], skip: [], blocked: [], pending: [] };
  for (const r of activeRows2) {
    const key = r.matchResult ?? "pending";
    grouped[key].push(r);
  }
  const applyRows: ImportBatchRow[] = [...(grouped.insert ?? []), ...(grouped.update ?? [])];
  const allBlocked = (grouped.blocked ?? []).length;
  const allPending = (grouped.pending ?? []).length;
  const allSkip = (grouped.skip ?? []).length;
  const skippedCount = allBlocked + allPending + allSkip;

  if (applyRows.length === 0) {
    return { inserted: 0, updated: 0, skipped: skippedCount, total: skippedCount };
  }

  const seasonLabel = (batch.seasonLabel ?? await getCurrentSeasonLabel(db)) ?? null;
  const fixtureStatements: SqlWrite[] = [];
  const fixtureMetadata: { rowId: number; finalAction: "insert" | "update"; fixtureId?: number; before?: Record<string, unknown> }[] = [];
  const staleUpdateRows: ImportBatchRow[] = [];

  for (const row of applyRows) {
    if (row.matchResult === "update") {
      const existing = await findExistingFixture(db, row, seasonLabel);
      if (existing) {
        fixtureStatements.push(buildFixtureUpdate(row, existing.id));
        fixtureMetadata.push({ rowId: row.id, finalAction: "update", fixtureId: existing.id, before: existing.before });
        continue;
      }
      staleUpdateRows.push(row);
      continue;
    }
    fixtureStatements.push(buildFixtureInsert(row, seasonLabel));
    fixtureMetadata.push({ rowId: row.id, finalAction: "insert" });
  }

  const totalSkipped = skippedCount + staleUpdateRows.length;

  const rowUpdateStatements: SqlWrite[] = [];
  const auditStatements: SqlWrite[] = [];

  // Write stale update markers before checking if there are fixture statements
  for (const row of staleUpdateRows) {
    rowUpdateStatements.push({
      sql: `UPDATE import_batch_rows SET match_result = 'blocked', final_action = 'blocked', warnings_json = ? WHERE id = ?`,
      params: [
        JSON.stringify({
          messages: ["Target fixture not found at apply time. The fixture may have been deleted."],
          fields: [],
        }),
        row.id,
      ],
    });
  }

  if (fixtureStatements.length === 0) {
    if (rowUpdateStatements.length > 0) {
      await db.writeBatch(rowUpdateStatements);
    }
    return { inserted: 0, updated: 0, skipped: totalSkipped, total: totalSkipped };
  }

  for (const meta of fixtureMetadata) {
    rowUpdateStatements.push({
      sql: `UPDATE import_batch_rows SET final_action = ?, final_fixture_id = ? WHERE id = ?`,
      params: [meta.finalAction, meta.fixtureId ?? null, meta.rowId],
    });

    const auditAction = meta.finalAction === "insert" ? "create" as const : "update" as const;
    auditStatements.push(buildAdminAuditLogWrite({
      action: auditAction,
      entityType: "fixture",
      entityId: meta.fixtureId,
      actor,
      before: meta.before,
      after: { import_batch_row_id: meta.rowId, batch_id: batchId },
    }));
  }

  const insertedCount = fixtureMetadata.filter((m) => m.finalAction === "insert").length;
  const updatedCount = fixtureMetadata.filter((m) => m.finalAction === "update").length;

  const approvalStatus = allBlocked > 0 || allPending > 0 || staleUpdateRows.length > 0
    ? "partially_approved" as const
    : "approved" as const;

  rowUpdateStatements.push({
    sql: `UPDATE import_batches SET approval_status = ?, row_count_approved = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    params: [approvalStatus, insertedCount + updatedCount, batchId],
  });

  // Build metadata statements with placeholder fixture IDs for inserts
  const metadataStatements = [...rowUpdateStatements, ...auditStatements];

  // Execute fixture writes + metadata in a single atomic batch
  const combinedStatements = [...fixtureStatements, ...metadataStatements];
  await db.writeBatch(combinedStatements);

  // Reconcile inserted fixture IDs via deterministic source/source_id.
  // This is idempotent — only updates rows with null final_fixture_id.
  const reconciledFixtures = await db.all<{ id: number; source_id: string }>(
    `SELECT id, source_id FROM fixtures
     WHERE source = 'import_batch'
       AND source_id LIKE ?`,
    [`${batchId}-%`]
  );
  for (const fx of reconciledFixtures) {
    const rowIdStr = fx.source_id.slice(String(batchId).length + 1);
    const rowId = parseInt(rowIdStr, 10);
    if (!isNaN(rowId)) {
      await db.run(
        `UPDATE import_batch_rows SET final_fixture_id = ? WHERE id = ? AND final_fixture_id IS NULL`,
        [fx.id, rowId]
      );
    }
  }

  return {
    inserted: insertedCount,
    updated: updatedCount,
    skipped: totalSkipped,
    total: insertedCount + updatedCount + totalSkipped,
  };
}
