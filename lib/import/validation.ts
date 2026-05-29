import type { AppDatabase, SqlWrite } from "../db/adapter.ts";
import type { ImportBatchRow, MatchResult, FixtureStatus, WarningIssue, IssueCode, KickoffAssumptionPolicy } from "./types.ts";
import { getBatch, getBatchRows } from "./importBatch.ts";
import { getCurrentSeasonLabel } from "./shared.ts";
import { createContext, toResult } from "./validationContext.ts";
import { resolveHomeParticipant, resolveAwayParticipant } from "./stages/resolveParticipants.ts";
import { resolveCompetition } from "./stages/resolveCompetition.ts";
import { resolveVenue } from "./stages/resolveVenue.ts";
import { normalizeDateTime } from "./stages/normalizeDateTime.ts";
import { validateMetadata } from "./stages/validateMetadata.ts";
import { matchFixture } from "./stages/matchFixture.ts";
import { detectDuplicates } from "./stages/detectDuplicates.ts";
import { createValidationCache, type ValidationCache } from "./validationCache.ts";

export interface ValidationWarning {
  field?: string;
  message: string;
  code?: IssueCode;
  issueKey?: string;
  severity?: "blocker" | "warning";
  rawValue?: string;
}

export interface RowValidationResult {
  matchResult: MatchResult;
  warnings: ValidationWarning[];
  homeParticipantResolvedId: number | null;
  awayParticipantResolvedId: number | null;
  competitionResolvedCode: string | null;
  venueResolvedId: number | null;
  normalizedDate?: string | null;
  normalizedTime?: string | null;
  normalizedStatus?: FixtureStatus | null;
  awayIsOneOff?: boolean;
  awayParticipantRaw?: string | null;
}

export interface BatchValidationResult {
  batchId: number;
  validatedCount: number;
  insertCount: number;
  updateCount: number;
  blockedCount: number;
  skippedCount: number;
}

export function buildValidationUpdateStatements(result: RowValidationResult, rowId: number): SqlWrite {
  const payload = result.warnings.length > 0 ? buildWarningsPayload(result.warnings) : { issues: [], messages: [] };
  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];

  setClauses.push("match_result = ?", "warnings_json = ?");
  params.push(result.matchResult, JSON.stringify(payload));

  setClauses.push("home_participant_resolved_id = ?", "away_participant_resolved_id = ?");
  params.push(result.homeParticipantResolvedId, result.awayParticipantResolvedId);

  setClauses.push("away_is_one_off = ?");
  params.push(result.awayIsOneOff ? 1 : 0);

  setClauses.push("competition_resolved_code = ?", "venue_resolved_id = ?");
  params.push(result.competitionResolvedCode, result.venueResolvedId);

  if (result.normalizedDate !== undefined) {
    setClauses.push("kickoff_date = ?");
    params.push(result.normalizedDate);
  }
  if (result.normalizedTime !== undefined) {
    setClauses.push("kickoff_time = ?");
    params.push(result.normalizedTime);
  }
  if (result.normalizedStatus !== undefined) {
    setClauses.push("status = ?");
    params.push(result.normalizedStatus);
  }

  params.push(rowId);
  return {
    sql: `UPDATE import_batch_rows SET ${setClauses.join(", ")} WHERE id = ?`,
    params,
  };
}

export async function validateImportBatch(
  db: AppDatabase,
  batchId: number,
  options?: {
    kickoffAssumptionPolicy?: KickoffAssumptionPolicy;
  }
): Promise<BatchValidationResult> {
  const batch = await getBatch(db, batchId);
  if (!batch) throw new Error(`Import batch ${batchId} not found.`);

  const rows = await getBatchRows(db, batchId);

  const seasonLabel = (batch.seasonLabel ?? await getCurrentSeasonLabel(db)) ?? null;

  // Pre-load all reference data once for the entire batch
  const cache = await createValidationCache(db);
  const seenBatchKeysStrict = new Set<string>();
  const seenBatchKeysRelaxed = new Set<string>();

  let insertCount = 0;
  let updateCount = 0;
  let blockedCount = 0;
  let skippedCount = 0;

  const updateStatements: SqlWrite[] = [];

  for (const row of rows) {
    if (row.finalAction) {
      skippedCount++;
      continue;
    }

    const validation = await validateRow(db, cache, seenBatchKeysStrict, seenBatchKeysRelaxed, row, seasonLabel, {
      kickoffAssumptionPolicy: options?.kickoffAssumptionPolicy,
    });

    updateStatements.push(buildValidationUpdateStatements(validation, row.id));

    if (validation.matchResult === "insert") insertCount++;
    else if (validation.matchResult === "update") updateCount++;
    else if (validation.matchResult === "blocked") blockedCount++;
    else skippedCount++;
  }

  if (updateStatements.length > 0) {
    await db.writeBatch(updateStatements);
  }

  return {
    batchId,
    validatedCount: rows.length - skippedCount,
    insertCount,
    updateCount,
    blockedCount,
    skippedCount,
  };
}

export function makeIssue(
  code: IssueCode,
  message: string,
  opts?: { field?: string; rawValue?: string; severity?: "blocker" | "warning" }
): ValidationWarning {
  const severity = opts?.severity ?? (code === "missing_ticket_info" ? "warning" : "blocker");
  return {
    code,
    severity,
    message,
    field: opts?.field,
    rawValue: opts?.rawValue,
    issueKey: opts?.rawValue ? `${code}:${opts.rawValue.toLowerCase()}` : code,
  };
}

export function buildWarningsPayload(warnings: ValidationWarning[]): { issues: WarningIssue[]; messages: string[] } {
  const issues: WarningIssue[] = [];
  for (const w of warnings) {
    if (w.code && w.severity) {
      issues.push({
        code: w.code,
        field: w.field,
        rawValue: w.rawValue,
        severity: w.severity as "blocker" | "warning",
        message: w.message,
        issueKey: w.issueKey ?? w.code,
      });
    }
  }
  const messages = warnings.map((w) => w.message);
  return { issues, messages };
}

export function isValidDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearStr, monthStr, dayStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  return day <= new Date(year, month, 0).getDate();
}

/* ── Duplicate detection helpers ── */

export async function findDuplicateInSameBatch(
  db: AppDatabase,
  row: ImportBatchRow,
): Promise<number | null> {
  if (!row.homeParticipantRaw || !row.awayParticipantRaw || !row.kickoffDate) return null;
  const result = await db.get<{ id: number }>(
    `SELECT id FROM import_batch_rows
     WHERE batch_id = ? AND id < ? AND final_action IS NULL
     AND home_participant_raw = ? AND away_participant_raw = ?
     AND kickoff_date = ?
     AND (competition_raw = ? OR (competition_raw IS NULL AND ? IS NULL))
     AND (kickoff_time = ? OR (kickoff_time IS NULL AND ? IS NULL))
     AND (venue_raw = ? OR (venue_raw IS NULL AND ? IS NULL))`,
    [row.batchId, row.id, row.homeParticipantRaw, row.awayParticipantRaw, row.kickoffDate,
     row.competitionRaw, row.competitionRaw,
     row.kickoffTime, row.kickoffTime,
     row.venueRaw, row.venueRaw]
  );
  return result?.id ?? null;
}

/**
 * Relaxed same-batch duplicate detection: finds an earlier unresolved row
 * with the same home participant, away participant, and kickoff date,
 * ignoring competition, kickoff time, and venue.
 */
export async function findRelaxedDuplicateInSameBatch(
  db: AppDatabase,
  row: ImportBatchRow,
): Promise<number | null> {
  if (!row.homeParticipantRaw || !row.awayParticipantRaw || !row.kickoffDate) return null;
  const result = await db.get<{ id: number }>(
    `SELECT id FROM import_batch_rows
     WHERE batch_id = ? AND id < ? AND final_action IS NULL
     AND home_participant_raw = ? AND away_participant_raw = ?
     AND kickoff_date = ?`,
    [row.batchId, row.id, row.homeParticipantRaw, row.awayParticipantRaw, row.kickoffDate]
  );
  return result?.id ?? null;
}

export function hasMeaningfulChanges(row: ImportBatchRow, before: Record<string, unknown>): boolean {
  if (row.kickoffDate && before.fixture_date && row.kickoffDate !== before.fixture_date) return true;
  if (row.competitionResolvedCode && before.competition_code && row.competitionResolvedCode !== before.competition_code) return true;
  if (row.venueResolvedId && row.venueRaw && before.venue_id !== null && row.venueResolvedId !== before.venue_id) return true;
  if (row.status && before.status && row.status !== before.status) return true;
  if (row.kickoffTime && before.kickoff_time && row.kickoffTime !== before.kickoff_time) return true;
  return false;
}

export async function findDuplicateBatchRow(
  db: AppDatabase,
  row: ImportBatchRow,
  excludeRowId: number,
): Promise<{ batchId: number; rowId: number } | null> {
  if (!row.competitionResolvedCode || !row.kickoffDate) return null;

  const isNormal = !row.homeIsOneOff && !row.awayIsOneOff && row.homeParticipantResolvedId && row.awayParticipantResolvedId;
  if (!isNormal) return null;

  const result = await db.get<{ id: number; batch_id: number }>(
    `SELECT r.id, r.batch_id FROM import_batch_rows r
     JOIN import_batches b ON b.id = r.batch_id
     WHERE r.id != ? AND r.batch_id != ? AND r.final_action IS NULL
     AND r.home_participant_resolved_id = ?
     AND r.away_participant_resolved_id = ?
     AND r.competition_resolved_code = ?
     AND r.kickoff_date = ?
     AND r.match_result NOT IN ('skip', 'blocked', 'duplicate_same_batch')
     AND b.approval_status IN ('pending', 'preview')`,
    [excludeRowId, row.batchId, row.homeParticipantResolvedId, row.awayParticipantResolvedId, row.competitionResolvedCode, row.kickoffDate]
  );
  if (!result) return null;
  return { batchId: result.batch_id, rowId: result.id };
}

export async function validateRow(
  db: AppDatabase,
  cache: ValidationCache,
  seenBatchKeysStrict: Set<string>,
  seenBatchKeysRelaxed: Set<string>,
  row: ImportBatchRow,
  seasonLabel: string | null,
  options?: { kickoffAssumptionPolicy?: KickoffAssumptionPolicy }
): Promise<RowValidationResult> {
  const ctx = createContext(row, seasonLabel, options);

  // All reference data is already in memory via ValidationCache —
  // these stages do zero DB queries.
  await resolveHomeParticipant(cache, ctx);
  await resolveCompetition(cache, ctx);
  await resolveAwayParticipant(cache, ctx);
  await resolveVenue(cache, ctx);
  normalizeDateTime(ctx);
  validateMetadata(ctx);

  // Only attempt fixture matching when basic data quality passes.
  if (ctx.hasBlocker) return toResult(ctx);

  await matchFixture(db, ctx);
  if (ctx.hasBlocker) return toResult(ctx);

  await detectDuplicates(db, cache, ctx, seenBatchKeysStrict, seenBatchKeysRelaxed);

  return toResult(ctx);
}
