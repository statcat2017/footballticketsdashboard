import type { AppDatabase, SqlWrite } from "../db/adapter.ts";
import type { ImportBatchRow } from "./types.ts";
import { getBatch, getBatchRowsByMatchResult } from "./importBatch.ts";
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

function buildFixtureInsert(row: ImportBatchRow, seasonLabel: string | null): SqlWrite {
  const source = "import_batch";
  const sourceId = `${row.batchId}-${row.id}`;
  const time = row.kickoffTime ?? (row.kickoffDate ? getAssumedKickoffTime(row.kickoffDate) : null);
  const kickoffAt = row.kickoffDate && time ? `${row.kickoffDate}T${time}:00.000Z` : null;
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
      source_updated_at = excluded.source_updated_at`,
    params: [
      source, sourceId, competitionCode,
      row.homeParticipantResolvedId,
      row.awayParticipantResolvedId,
      row.venueResolvedId,
      kickoffAt,
      row.kickoffDate,
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

function buildFixtureUpdate(row: ImportBatchRow, fixtureId: number): SqlWrite {
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
  if (row.venueResolvedId) {
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

async function findExistingFixture(
  db: AppDatabase,
  row: ImportBatchRow,
  seasonLabel: string | null,
): Promise<ExistingFixture | null> {
  if (!row.competitionResolvedCode) return null;

  let fixture: Record<string, unknown> | undefined;

  if (row.homeIsOneOff && row.awayIsOneOff) {
    fixture = await db.get<Record<string, unknown>>(
      `SELECT * FROM fixtures
       WHERE competition_code = ? AND season_label = ?
       AND home_one_off_name = ? AND away_one_off_name = ?`,
      [row.competitionResolvedCode, seasonLabel, row.homeParticipantRaw, row.awayParticipantRaw]
    );
  } else if (row.homeIsOneOff && row.awayParticipantResolvedId) {
    fixture = await db.get<Record<string, unknown>>(
      `SELECT * FROM fixtures
       WHERE competition_code = ? AND season_label = ?
       AND home_one_off_name = ? AND away_club_id = ?`,
      [row.competitionResolvedCode, seasonLabel, row.homeParticipantRaw, row.awayParticipantResolvedId]
    );
  } else if (row.awayIsOneOff && row.homeParticipantResolvedId) {
    fixture = await db.get<Record<string, unknown>>(
      `SELECT * FROM fixtures
       WHERE competition_code = ? AND season_label = ?
       AND away_one_off_name = ? AND home_club_id = ?`,
      [row.competitionResolvedCode, seasonLabel, row.awayParticipantRaw, row.homeParticipantResolvedId]
    );
  } else if (row.homeParticipantResolvedId && row.awayParticipantResolvedId) {
    fixture = await db.get<Record<string, unknown>>(
      `SELECT * FROM fixtures
       WHERE home_club_id = ? AND away_club_id = ? AND competition_code = ? AND season_label = ?`,
      [row.homeParticipantResolvedId, row.awayParticipantResolvedId, row.competitionResolvedCode, seasonLabel]
    );
  }

  if (!fixture) return null;

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

  if (batch.approvalStatus === "approved" || batch.approvalStatus === "partially_approved") {
    throw new Error(`Import batch ${batchId} has already been applied.`);
  }

  const grouped = await getBatchRowsByMatchResult(db, batchId);
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
  const fixtureRowMapping: { rowId: number; isUpdate: boolean; fixtureId?: number }[] = [];

  for (const row of applyRows) {
    if (row.matchResult === "update") {
      const existing = await findExistingFixture(db, row, seasonLabel);
      if (existing) {
        fixtureStatements.push(buildFixtureUpdate(row, existing.id));
        fixtureRowMapping.push({ rowId: row.id, isUpdate: true, fixtureId: existing.id });
        continue;
      }
    }
    fixtureStatements.push(buildFixtureInsert(row, seasonLabel));
    fixtureRowMapping.push({ rowId: row.id, isUpdate: false });
  }

  if (fixtureStatements.length === 0) {
    return { inserted: 0, updated: 0, skipped: skippedCount, total: skippedCount };
  }

  const fixtureResults = await db.writeBatch(fixtureStatements);

  const rowUpdateStatements: SqlWrite[] = [];
  const auditStatements: SqlWrite[] = [];
  let insertedCount = 0;
  let updatedCount = 0;

  for (let i = 0; i < fixtureRowMapping.length; i++) {
    const mapping = fixtureRowMapping[i];
    const row = applyRows.find((r) => r.id === mapping.rowId);
    if (!row) continue;

    let fixtureId: number | undefined = mapping.fixtureId;
    if (!fixtureId && fixtureResults[i]) {
      fixtureId = fixtureResults[i].lastInsertRowid;
    }

    const finalAction = row.matchResult === "update" ? "update" as const : "insert" as const;
    if (finalAction === "insert") insertedCount++;
    else updatedCount++;

    rowUpdateStatements.push({
      sql: `UPDATE import_batch_rows SET final_action = ?, final_fixture_id = ? WHERE id = ?`,
      params: [finalAction, fixtureId ?? null, row.id],
    });

    auditStatements.push(buildAdminAuditLogWrite({
      action: finalAction === "insert" ? "create" : "update",
      entityType: "fixture",
      entityId: fixtureId,
      actor,
    }));
  }

  const approvalStatus = allBlocked > 0 || allPending > 0
    ? "partially_approved" as const
    : "approved" as const;

  rowUpdateStatements.push({
    sql: `UPDATE import_batches SET approval_status = ?, row_count_approved = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    params: [approvalStatus, insertedCount + updatedCount, batchId],
  });

  const allStatements = [...rowUpdateStatements, ...auditStatements];
  if (allStatements.length > 0) {
    await db.writeBatch(allStatements);
  }

  return {
    inserted: insertedCount,
    updated: updatedCount,
    skipped: skippedCount,
    total: insertedCount + updatedCount + skippedCount,
  };
}
