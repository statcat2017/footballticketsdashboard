import type { AppDatabase, SqlWrite } from "../db/adapter.ts";
import type { ImportBatchRow, RowEditFields, WarningIssue, WarningsPayload, KickoffAssumptionPolicy } from "./types.ts";
import { getBatch, getBatchRow, getBatchRows, updateBatchRow, updateBatchStatus } from "./importBatch.ts";
import { buildWarningsPayload, validateRow, buildValidationUpdateStatements } from "./validation.ts";
import { buildAdminAuditLogWrite } from "../admin/audit.ts";
import { buildFixtureInsert, buildFixtureUpdate } from "./apply.ts";
import { getCurrentSeasonLabel } from "./shared";
import { findImportFixtureMatch } from "./fixtureIdentity";
import { createValidationCache, type ValidationCache } from "./validationCache.ts";


export interface ApplySingleResult {
  row: ImportBatchRow;
  fixtureId: number | null;
}

function buildWarningsUpdate(warnings: WarningsPayload | null): string | null {
  if (!warnings) return null;
  return JSON.stringify(warnings);
}

export async function validateRowById(
  db: AppDatabase,
  rowId: number,
  seasonLabelArg?: string | null,
  options?: {
    kickoffAssumptionPolicy?: KickoffAssumptionPolicy;
    skipReturn?: boolean;
    cache?: ValidationCache;
  }
): Promise<ImportBatchRow> {
  const row = await getBatchRow(db, rowId);
  if (!row) throw new Error(`Import batch row ${rowId} not found.`);
  if (row.finalAction) return row;

  const batch = await getBatch(db, row.batchId);
  if (!batch) throw new Error(`Import batch ${row.batchId} not found.`);

  const seasonLabel = (seasonLabelArg ?? batch.seasonLabel ?? await getCurrentSeasonLabel(db)) ?? null;
  const cache = options?.cache ?? await createValidationCache(db);
  const seenBatchKeys = new Set<string>();
  const validation = await validateRow(db, cache, seenBatchKeys, row, seasonLabel, {
    kickoffAssumptionPolicy: options?.kickoffAssumptionPolicy,
  });

  const payload = validation.warnings.length > 0 ? buildWarningsPayload(validation.warnings) : null;

  const updates: Parameters<typeof updateBatchRow>[2] = {
    matchResult: validation.matchResult,
    warningsJson: buildWarningsUpdate(payload),
    homeParticipantResolvedId: validation.homeParticipantResolvedId,
    awayParticipantResolvedId: validation.awayParticipantResolvedId,
    competitionResolvedCode: validation.competitionResolvedCode,
    venueResolvedId: validation.venueResolvedId,
  };
  if (validation.normalizedDate !== undefined) updates.kickoffDate = validation.normalizedDate;
  if (validation.normalizedTime !== undefined) updates.kickoffTime = validation.normalizedTime;
  if (validation.normalizedStatus !== undefined) updates.status = validation.normalizedStatus;

  if (options?.skipReturn) {
    // Fast path: UPDATE directly without re-fetching the row
    const stmt = buildValidationUpdateStatements(validation, rowId);
    await db.run(stmt.sql, stmt.params);
    return row;
  }

  return updateBatchRow(db, rowId, updates);
}

export async function editAndRevalidateRow(
  db: AppDatabase,
  rowId: number,
  edits: RowEditFields,
  actor: string,
  options?: { cache?: ValidationCache }
): Promise<ImportBatchRow> {
  const row = await getBatchRow(db, rowId);
  if (!row) throw new Error(`Import batch row ${rowId} not found.`);
  if (row.finalAction) throw new Error(`Row ${rowId} has final action "${row.finalAction}" and cannot be edited.`);

  const changedFields: Record<string, { from: unknown; to: unknown }> = {};
  const sqlFields: string[] = [];
  const sqlParams: (string | number | null)[] = [];

  const rawFieldMap: Record<string, { column: string; current: string | null }> = {
    homeParticipantRaw: { column: "home_participant_raw", current: row.homeParticipantRaw },
    awayParticipantRaw: { column: "away_participant_raw", current: row.awayParticipantRaw },
    competitionRaw: { column: "competition_raw", current: row.competitionRaw },
    venueRaw: { column: "venue_raw", current: row.venueRaw },
    kickoffDate: { column: "kickoff_date", current: row.kickoffDate },
    kickoffTime: { column: "kickoff_time", current: row.kickoffTime },
    ticketUrl: { column: "ticket_url", current: row.ticketUrl },
    sourceUrl: { column: "source_url", current: row.sourceUrl },
  };

  for (const [fieldName, map] of Object.entries(rawFieldMap)) {
    const key = fieldName as keyof RowEditFields;
    if (edits[key] === undefined) continue;
    const newVal = edits[key] ?? null;
    if (newVal !== map.current) {
      changedFields[fieldName] = { from: map.current, to: newVal };
      sqlFields.push(`${map.column} = ?`);
      sqlParams.push(newVal);
    }
  }

  if (sqlFields.length === 0) return validateRowById(db, rowId, undefined, { cache: options?.cache });

  sqlParams.push(rowId);
  await db.run(
    `UPDATE import_batch_rows SET ${sqlFields.join(", ")} WHERE id = ?`,
    sqlParams
  );

  await db.run(
    `INSERT INTO import_batch_row_actions (batch_id, row_id, action, actor, metadata_json) VALUES (?, ?, 'edit_row', ?, ?)`,
    [row.batchId, rowId, actor, JSON.stringify({ changedFields })]
  );

  await db.writeBatch([
    buildAdminAuditLogWrite({
      action: "update",
      entityType: "import_batch_row",
      entityId: rowId,
      actor,
      before: { batchId: row.batchId, rawFields: rawFieldToRecord(row) },
      after: { batchId: row.batchId, edits: changedFields },
    }),
  ]);

  return validateRowById(db, rowId, undefined, { cache: options?.cache });
}

function rawFieldToRecord(row: ImportBatchRow): Record<string, string | null> {
  return {
    homeParticipantRaw: row.homeParticipantRaw,
    awayParticipantRaw: row.awayParticipantRaw,
    competitionRaw: row.competitionRaw,
    venueRaw: row.venueRaw,
    kickoffDate: row.kickoffDate,
    kickoffTime: row.kickoffTime,
    status: row.status,
    ticketUrl: row.ticketUrl,
    sourceUrl: row.sourceUrl,
  };
}

export async function importSingleRow(
  db: AppDatabase,
  rowId: number,
  actor: string,
  options?: {
    kickoffAssumptionPolicy?: KickoffAssumptionPolicy;
    cache?: ValidationCache;
  }
): Promise<ApplySingleResult> {
  const row = await getBatchRow(db, rowId);
  if (!row) throw new Error(`Import batch row ${rowId} not found.`);
  if (row.finalAction) throw new Error(`Row ${rowId} has final action "${row.finalAction}" and cannot be imported again.`);

  const revalidated = await validateRowById(db, rowId, undefined, {
    kickoffAssumptionPolicy: options?.kickoffAssumptionPolicy,
    cache: options?.cache,
  });
  if (revalidated.matchResult === "blocked") {
    return { row: revalidated, fixtureId: null };
  }
  if (revalidated.matchResult !== "insert" && revalidated.matchResult !== "update") {
    throw new Error(`Row ${rowId} has unexpected match result "${revalidated.matchResult}".`);
  }

  const batch = await getBatch(db, row.batchId);
  if (!batch) throw new Error(`Import batch ${row.batchId} not found.`);

  const seasonLabel = (batch.seasonLabel ?? await getCurrentSeasonLabel(db)) ?? null;
  const statements: SqlWrite[] = [];
  const auditStmts: SqlWrite[] = [];

  let fixtureId: number | undefined;
  let action: "import_insert" | "import_update";

  if (revalidated.matchResult === "update") {
    const existing = await findImportFixtureMatch(db, revalidated, seasonLabel);
    if (existing.kind === "match") {
      statements.push(buildFixtureUpdate(revalidated, existing.id));
      fixtureId = existing.id;
      action = "import_update";
      auditStmts.push(buildAdminAuditLogWrite({
        action: "update",
        entityType: "fixture",
        entityId: existing.id,
        actor,
        before: existing.before,
        after: { import_batch_row_id: rowId, batch_id: row.batchId },
      }));
    } else {
      // Stale update — mark blocked but keep final_action NULL so it stays recoverable
      const warningsJson = JSON.stringify({
        issues: [{
          code: "venue_not_found" as const,
          severity: "blocker" as const,
          message: "Target fixture not found at apply time. The fixture may have been deleted.",
          issueKey: "stale_update",
        }],
        messages: ["Target fixture not found at apply time. The fixture may have been deleted."],
      });
      await db.writeBatch([
        {
          sql: `UPDATE import_batch_rows SET match_result = 'blocked', final_action = NULL, warnings_json = ? WHERE id = ?`,
          params: [warningsJson, rowId],
        },
      ]);
      const updated = await getBatchRow(db, rowId);
      return { row: updated!, fixtureId: null };
    }
  } else {
    statements.push(buildFixtureInsert(revalidated, seasonLabel, options?.kickoffAssumptionPolicy));
    action = "import_insert";
    auditStmts.push(buildAdminAuditLogWrite({
      action: "create",
      entityType: "fixture",
      actor,
      after: { import_batch_row_id: rowId, batch_id: row.batchId },
    }));
  }

  statements.push({
    sql: `UPDATE import_batch_rows SET final_action = ?, final_fixture_id = ? WHERE id = ?`,
    params: [revalidated.matchResult === "update" ? "update" : "insert", fixtureId ?? null, rowId],
  });

  statements.push({
    sql: `INSERT INTO import_batch_row_actions (batch_id, row_id, action, actor) VALUES (?, ?, ?, ?)`,
    params: [row.batchId, rowId, action, actor],
  });

  if (fixtureId) {
    await db.writeBatch([...statements, ...auditStmts]);
  } else {
    await db.writeBatch(statements);
    // For inserts, reconcile the fixture ID
    const reconciledFixtures = await db.all<{ id: number; source_id: string }>(
      `SELECT id, source_id FROM fixtures
       WHERE source = 'import_batch' AND source_id = ?`,
      [`${row.batchId}-${rowId}`]
    );
    if (reconciledFixtures.length > 0) {
      fixtureId = reconciledFixtures[0].id;
      await db.run(
        `UPDATE import_batch_rows SET final_fixture_id = ? WHERE id = ? AND final_fixture_id IS NULL`,
        [fixtureId, rowId]
      );
    }
    await db.writeBatch(auditStmts);
  }

  const updated = await getBatchRow(db, rowId);
  await updateBatchApprovalStatus(db, row.batchId);

  return { row: updated!, fixtureId: fixtureId ?? null };
}

export async function skipRow(
  db: AppDatabase,
  rowId: number,
  reason: string,
  actor: string,
  note?: string,
): Promise<ImportBatchRow> {
  const row = await getBatchRow(db, rowId);
  if (!row) throw new Error(`Import batch row ${rowId} not found.`);
  if (row.finalAction) throw new Error(`Row ${rowId} has final action "${row.finalAction}" and cannot be skipped.`);

  const validReasons = ["duplicate", "bad_source_row", "not_relevant", "needs_later_review", "other"];
  if (!validReasons.includes(reason)) {
    throw new Error(`Invalid skip reason "${reason}". Must be one of: ${validReasons.join(", ")}`);
  }

  await db.run(
    `UPDATE import_batch_rows SET match_result = 'skip', final_action = 'skip' WHERE id = ?`,
    [rowId]
  );

  await db.run(
    `INSERT INTO import_batch_row_actions (batch_id, row_id, action, reason, note, actor) VALUES (?, ?, 'skip', ?, ?, ?)`,
    [row.batchId, rowId, reason, note ?? null, actor]
  );

  await db.writeBatch([
    buildAdminAuditLogWrite({
      action: "update",
      entityType: "import_batch_row",
      entityId: rowId,
      actor,
      before: { batchId: row.batchId, finalAction: null, matchResult: row.matchResult },
      after: { batchId: row.batchId, finalAction: "skip", reason, note: note ?? null },
    }),
  ]);

  const updated = await getBatchRow(db, rowId);
  await updateBatchApprovalStatus(db, row.batchId);

  return updated!;
}

async function updateBatchApprovalStatus(db: AppDatabase, batchId: number): Promise<void> {
  const rows = await getBatchRows(db, batchId);
  const finalizedCount = rows.filter((r) => r.finalAction).length;
  const approvedCount = rows.filter((r) => r.finalAction === "insert" || r.finalAction === "update").length;
  const allFinalized = finalizedCount === rows.length;

  if (allFinalized) {
    await updateBatchStatus(db, batchId, { approvalStatus: "approved" });
  } else if (approvedCount > 0) {
    await updateBatchStatus(db, batchId, { approvalStatus: "partially_approved" });
  }
}

export async function acknowledgeBatchIssue(
  db: AppDatabase,
  batchId: number,
  issueKey: string,
  actor: string,
  opts?: { rowId?: number; note?: string; issueCode?: string },
): Promise<void> {
  const issueCode = opts?.issueCode ?? issueKey.split(":")[0];

  await db.run(
    `INSERT INTO import_batch_issue_resolutions (batch_id, row_id, issue_code, issue_key, resolution_type, actor, note)
     VALUES (?, ?, ?, ?, 'acknowledged', ?, ?)`,
    [batchId, opts?.rowId ?? null, issueCode, issueKey, actor, opts?.note ?? null]
  );

  await db.writeBatch([
    buildAdminAuditLogWrite({
      action: "create",
      entityType: "import_batch_issue_resolution",
      actor,
      after: { batchId, rowId: opts?.rowId, issueCode, issueKey, note: opts?.note ?? null },
    }),
  ]);
}

export async function getActiveIssuesForBatch(
  db: AppDatabase,
  batchId: number,
): Promise<WarningIssue[]> {
  const rows = await getBatchRows(db, batchId);
  const allIssues: Map<string, WarningIssue> = new Map();

  for (const row of rows) {
    if (!row.warningsJson || row.finalAction) continue;
    try {
      const parsed = JSON.parse(row.warningsJson) as { issues?: WarningIssue[] };
      if (parsed.issues) {
        for (const issue of parsed.issues) {
          const rowKey = row.id ? `${issue.issueKey}:row:${row.id}` : issue.issueKey;
          allIssues.set(rowKey, issue);
        }
      }
    } catch {
      // skip malformed warnings
    }
  }

  const resolutions = await db.all<{ issue_key: string; row_id: number | null }>(
    `SELECT issue_key, row_id FROM import_batch_issue_resolutions WHERE batch_id = ?`,
    [batchId]
  );

  const acknowledged = new Set<string>();
  const acknowledgedBatchKeys = new Set<string>();
  for (const r of resolutions) {
    if (r.row_id) {
      acknowledged.add(`${r.issue_key}:row:${r.row_id}`);
    } else {
      acknowledgedBatchKeys.add(r.issue_key);
    }
  }

  const active: WarningIssue[] = [];
  for (const [key, issue] of allIssues) {
    if (acknowledged.has(key)) continue;
    // Check if a batch-level acknowledgement covers this issue key
    if (acknowledgedBatchKeys.has(issue.issueKey)) continue;
    active.push(issue);
  }

  return active;
}

export async function getRowActions(
  db: AppDatabase,
  batchId: number,
  rowId?: number,
): Promise<Array<{ id: number; action: string; reason: string | null; note: string | null; actor: string; metadataJson: string | null; createdAt: string }>> {
  if (rowId) {
    return db.all<{ id: number; action: string; reason: string | null; note: string | null; actor: string; metadataJson: string | null; createdAt: string }>(
      `SELECT id, action, reason, note, actor, metadata_json, created_at FROM import_batch_row_actions WHERE batch_id = ? AND row_id = ? ORDER BY created_at DESC`,
      [batchId, rowId]
    );
  }
  return db.all<{ id: number; action: string; reason: string | null; note: string | null; actor: string; metadataJson: string | null; createdAt: string }>(
    `SELECT id, action, reason, note, actor, metadata_json, created_at FROM import_batch_row_actions WHERE batch_id = ? ORDER BY created_at DESC`,
    [batchId]
  );
}

export async function revalidatePendingRowsForVenue(
  db: AppDatabase,
  venueId: number,
  clubIds: number[],
): Promise<number> {
  if (clubIds.length === 0) return 0;

  const placeholders = clubIds.map(() => "?").join(", ");
  const rows = await db.all<{ id: number }>(
    `SELECT id FROM import_batch_rows
     WHERE final_action IS NULL
       AND home_participant_resolved_id IN (${placeholders})
       AND (venue_resolved_id = ? OR venue_resolved_id IS NULL)`,
    [...clubIds, venueId]
  );

  let revalidatedCount = 0;
  const cache = await createValidationCache(db);
  for (const row of rows) {
    await validateRowById(db, row.id, undefined, { skipReturn: true, cache });
    revalidatedCount++;
  }

  return revalidatedCount;
}
