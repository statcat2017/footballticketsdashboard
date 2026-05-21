import type { AppDatabase, SqlWrite } from "../db/adapter.ts";
import type { ImportBatchRow, MatchResult, FixtureStatus, WarningIssue, IssueCode, KickoffAssumptionPolicy } from "./types.ts";
import {
  resolveFixtureParticipant,
  resolveCompetitionFromFixture,
  normalizeName,
} from "../db/clubMapping.ts";
import { getBatch, getBatchRows } from "./importBatch.ts";
import { parseDateField, parseTimeField } from "./adapters/csv.ts";
import { getCurrentSeasonLabel, isWeekend, getAssumedKickoffTime } from "./shared";
import { findImportFixtureMatch } from "./fixtureIdentity";

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

    const validation = await validateRow(db, row, seasonLabel, {
      kickoffAssumptionPolicy: options?.kickoffAssumptionPolicy,
    });

    const payload = validation.warnings.length > 0 ? buildWarningsPayload(validation.warnings) : { issues: [], messages: [] };
    const setClauses: string[] = [];
    const params: (string | number | null)[] = [];

    setClauses.push("match_result = ?", "warnings_json = ?");
    params.push(validation.matchResult, JSON.stringify(payload));

    setClauses.push("home_participant_resolved_id = ?", "away_participant_resolved_id = ?");
    params.push(validation.homeParticipantResolvedId, validation.awayParticipantResolvedId);

    setClauses.push("away_is_one_off = ?");
    params.push(validation.awayIsOneOff ? 1 : 0);

    setClauses.push("competition_resolved_code = ?", "venue_resolved_id = ?");
    params.push(validation.competitionResolvedCode, validation.venueResolvedId);

    if (validation.normalizedDate !== undefined) {
      setClauses.push("kickoff_date = ?");
      params.push(validation.normalizedDate);
    }
    if (validation.normalizedTime !== undefined) {
      setClauses.push("kickoff_time = ?");
      params.push(validation.normalizedTime);
    }
    if (validation.normalizedStatus !== undefined) {
      setClauses.push("status = ?");
      params.push(validation.normalizedStatus);
    }

    params.push(row.id);
    updateStatements.push({
      sql: `UPDATE import_batch_rows SET ${setClauses.join(", ")} WHERE id = ?`,
      params,
    });

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



function makeIssue(
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

function isValidDateString(value: string): boolean {
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

interface ClubResolveResult {
  clubId: number | null;
  warnings: ValidationWarning[];
  isBlocked: boolean;
}

async function resolveParticipant(
  db: AppDatabase,
  name: string | null,
  isOneOff: boolean,
  competitionCode?: string,
  field?: string,
): Promise<ClubResolveResult> {
  const warnings: ValidationWarning[] = [];

  if (!name) {
    if (!isOneOff) {
      return { clubId: null, warnings: [makeIssue("missing_participant", `Missing ${field ?? "participant"}`, { field })], isBlocked: true };
    }
    return { clubId: null, warnings, isBlocked: false };
  }

  if (isOneOff) {
    return { clubId: null, warnings, isBlocked: false };
  }

  const normalized = normalizeName(name);

  if (competitionCode) {
    // Scoped alias wins: check scoped matches for ambiguity; ignore global aliases
    const scopedMatches = await db.all<{ club_id: number }>(
      `SELECT ca.club_id FROM club_aliases ca
       WHERE ca.normalized_alias = ? AND ca.retired_at IS NULL
         AND ca.competition_code = ?`,
      [normalized, competitionCode]
    );
    if (scopedMatches.length > 1) {
      const clubs = await db.all<{ name: string }>(
        `SELECT c.name FROM clubs c
         JOIN club_aliases ca ON ca.club_id = c.id
         WHERE ca.normalized_alias = ? AND ca.retired_at IS NULL
           AND ca.competition_code = ?`,
        [normalized, competitionCode]
      );
      const names = clubs.map((c) => c.name).join(", ");
      warnings.push(makeIssue("ambiguous_club", `Ambiguous alias matches ${clubs.length} clubs: ${names}`, { field, rawValue: name }));
      return { clubId: null, warnings, isBlocked: true };
    }
  } else {
    const unscopedMatches = await db.all<{ club_id: number }>(
      `SELECT ca.club_id FROM club_aliases ca
       WHERE ca.normalized_alias = ? AND ca.retired_at IS NULL
         AND ca.competition_code IS NULL`,
      [normalized]
    );
    if (unscopedMatches.length > 1) {
      const clubs = await db.all<{ name: string }>(
        `SELECT c.name FROM clubs c
         JOIN club_aliases ca ON ca.club_id = c.id
         WHERE ca.normalized_alias = ? AND ca.retired_at IS NULL
           AND ca.competition_code IS NULL`,
        [normalized]
      );
      const names = clubs.map((c) => c.name).join(", ");
      warnings.push(makeIssue("ambiguous_club", `Ambiguous alias matches ${clubs.length} clubs: ${names}`, { field, rawValue: name }));
      return { clubId: null, warnings, isBlocked: true };
    }
  }

  const resolved = await resolveFixtureParticipant(db, name, {
    competitionCode,
  });

  if (resolved.mappingType === "unknown" || resolved.mappingType === "ambiguous") {
    warnings.push(makeIssue("unknown_club", `Unknown club: ${name}. Verify the club name or add an alias.`, { field, rawValue: name }));
    return { clubId: null, warnings, isBlocked: true };
  }

  return { clubId: resolved.publicClubId, warnings, isBlocked: false };
}

interface CompetitionResolveResult {
  code: string | null;
  warnings: ValidationWarning[];
  isBlocked: boolean;
}

async function resolveCompetition(
  db: AppDatabase,
  competitionRaw: string | null,
  homeClubId: number | null,
): Promise<CompetitionResolveResult> {
  const warnings: ValidationWarning[] = [];

  if (competitionRaw) {
    const comp = await db.get<{ code: string; name: string }>(
      `SELECT code, name FROM competitions WHERE code = ? OR name = ?`,
      [competitionRaw, competitionRaw]
    );
    if (comp) {
      return { code: comp.code, warnings, isBlocked: false };
    }
  }

  if (homeClubId) {
    const inferred = await resolveCompetitionFromFixture(db, homeClubId, competitionRaw ?? "");
    if (inferred) {
      return { code: inferred, warnings, isBlocked: false };
    }
  }

  if (competitionRaw) {
    warnings.push(makeIssue("unknown_competition", `Unknown competition: ${competitionRaw}. Add a competition mapping for the club's division or specify a known competition.`, { rawValue: competitionRaw }));
  } else {
    warnings.push(makeIssue("missing_competition", "No competition specified and could not infer from home club."));
  }
  return { code: null, warnings, isBlocked: true };
}

interface VenueResolveResult {
  venueId: number | null;
  warnings: ValidationWarning[];
  isBlocked: boolean;
}

async function resolveVenue(
  db: AppDatabase,
  venueRaw: string | null,
  homeClubId: number | null,
  homeIsOneOff: boolean,
): Promise<VenueResolveResult> {
  const warnings: ValidationWarning[] = [];

  if (venueRaw) {
    const venue = await db.get<{ id: number; name: string; latitude: number; longitude: number }>(
      `SELECT id, name, latitude, longitude FROM venues WHERE name = ?`,
      [venueRaw]
    );
    if (venue) {
      if (venue.latitude === 0 && venue.longitude === 0) {
        warnings.push(makeIssue("venue_unusable_coords", `Venue "${venue.name}" has unusable coordinates. Fix venue coordinates.`, { rawValue: venue.name }));
      }
      return { venueId: venue.id, warnings, isBlocked: false };
    }
    if (homeClubId) {
      const cva = await db.get<{ venue_id: number }>(
        `SELECT venue_id FROM club_venue_assignments WHERE club_id = ? AND is_primary = 1 AND effective_to IS NULL`,
        [homeClubId]
      );
      if (cva?.venue_id) {
        warnings.push(makeIssue("venue_not_found", `Venue "${venueRaw}" not found. Using home club's primary venue.`, { field: "venue", rawValue: venueRaw }));
        return { venueId: cva.venue_id, warnings, isBlocked: false };
      }
    }
    return { venueId: null, warnings: [makeIssue("venue_not_found", `Venue "${venueRaw}" not found and home club has no primary venue.`, { rawValue: venueRaw })], isBlocked: true };
  }

  if (homeIsOneOff) {
    return { venueId: null, warnings: [makeIssue("one_off_needs_venue", "One-off home participant needs an explicit venue.")], isBlocked: true };
  }

  if (homeClubId) {
    const cva = await db.get<{ venue_id: number }>(
      `SELECT venue_id FROM club_venue_assignments WHERE club_id = ? AND is_primary = 1 AND effective_to IS NULL`,
      [homeClubId]
    );
    if (cva?.venue_id) {
      return { venueId: cva.venue_id, warnings, isBlocked: false };
    }
  }

  return { venueId: null, warnings: [makeIssue("missing_primary_venue", "Home club has no primary venue.")], isBlocked: true };
}

const VALID_FIXTURE_STATUSES: FixtureStatus[] = ["scheduled", "postponed", "cancelled", "finished", "unknown"];

/* ── Duplicate detection ── */

function hasMeaningfulChanges(row: ImportBatchRow, before: Record<string, unknown>): boolean {
  if (row.kickoffDate && before.fixture_date && row.kickoffDate !== before.fixture_date) return true;
  if (row.competitionResolvedCode && before.competition_code && row.competitionResolvedCode !== before.competition_code) return true;
  if (row.venueResolvedId && row.venueRaw && before.venue_id !== null && row.venueResolvedId !== before.venue_id) return true;
  if (row.status && before.status && row.status !== before.status) return true;
  if (row.kickoffTime && before.kickoff_time && row.kickoffTime !== before.kickoff_time) return true;
  return false;
}

async function findDuplicateInSameBatch(
  db: AppDatabase,
  row: ImportBatchRow,
): Promise<number | null> {
  if (!row.homeParticipantRaw || !row.awayParticipantRaw || !row.kickoffDate) return null;
  // Only find rows with a lower id (inserted earlier), so first occurrence is never tagged as duplicate
  // Match on raw fields plus competition/time/venue to avoid false positives
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

async function findDuplicateBatchRow(
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
  row: ImportBatchRow,
  seasonLabel: string | null,
  options?: {
    kickoffAssumptionPolicy?: KickoffAssumptionPolicy;
  }
): Promise<RowValidationResult> {
  const warnings: ValidationWarning[] = [];
  let hasBlocker = false;

  let competitionCode: string | null = null;
  let competitionKind: string | null = null;

  const home = await resolveParticipant(db, row.homeParticipantRaw, row.homeIsOneOff, undefined, "home");
  warnings.push(...home.warnings);
  if (home.isBlocked) hasBlocker = true;

  const compResult = await resolveCompetition(db, row.competitionRaw, home.clubId);
  competitionCode = compResult.code;
  if (compResult.isBlocked) {
    warnings.push(...compResult.warnings);
    hasBlocker = true;
  }

  if (competitionCode) {
    const comp = await db.get<{ kind: string }>(
      `SELECT kind FROM competitions WHERE code = ?`,
      [competitionCode]
    );
    competitionKind = comp?.kind ?? null;
  }

  const awayRaw = await resolveParticipant(db, row.awayParticipantRaw, row.awayIsOneOff, competitionCode ?? undefined, "away");
  const friendlyOverride = competitionKind === "friendly" && row.awayParticipantRaw && awayRaw.isBlocked;
  const away = friendlyOverride
    ? { clubId: null, isBlocked: false, warnings: [] as ValidationWarning[] }
    : awayRaw;
  const resolvedAwayIsOneOff = friendlyOverride ? true : row.awayIsOneOff;
  warnings.push(...away.warnings);
  if (away.isBlocked) hasBlocker = true;

  const venue = await resolveVenue(db, row.venueRaw, home.clubId, row.homeIsOneOff);
  warnings.push(...venue.warnings);
  if (venue.isBlocked) hasBlocker = true;

  let dateStr: string | null = row.kickoffDate;
  let kickoffTime: string | null = row.kickoffTime;
  let normalizedDate: string | null | undefined;
  let normalizedTime: string | null | undefined;

  if (dateStr) {
    const parsed = parseDateField(dateStr);
    if (!parsed) {
      if (!isValidDateString(dateStr)) {
        warnings.push(makeIssue("invalid_date", `Invalid date: ${dateStr}`, { field: "date", rawValue: dateStr }));
        hasBlocker = true;
      } else {
        normalizedDate = dateStr;
      }
    } else {
      dateStr = parsed.date;
      normalizedDate = parsed.date;
      if (parsed.time) {
        kickoffTime = parsed.time;
        normalizedTime = parsed.time;
      }
    }
  } else {
    warnings.push(makeIssue("missing_date", "Missing fixture date.", { field: "date" }));
    hasBlocker = true;
  }

  if (kickoffTime) {
    const parsedTime = parseTimeField(kickoffTime);
    if (!parsedTime) {
      warnings.push(makeIssue("invalid_time", `Invalid kickoff time: ${kickoffTime}`, { field: "time", rawValue: kickoffTime }));
      hasBlocker = true;
    } else {
      kickoffTime = parsedTime;
      normalizedTime = parsedTime;
    }
  } else if (dateStr && !hasBlocker) {
    kickoffTime = getAssumedKickoffTime(dateStr, options?.kickoffAssumptionPolicy);
    if (kickoffTime) {
      warnings.push(makeIssue("assumed_time",
        isWeekend(dateStr)
          ? `Kickoff time assumed ${kickoffTime} (weekend).`
          : `Kickoff time assumed ${kickoffTime} (midweek).`,
        { severity: "warning" }
      ));
    }
  }

  let normalizedStatus: FixtureStatus | null | undefined;
  if (row.status) {
    if (!VALID_FIXTURE_STATUSES.includes(row.status)) {
      warnings.push(makeIssue("invalid_status", `Invalid status: ${row.status}. Allowed: ${VALID_FIXTURE_STATUSES.join(", ")}.`, { field: "status" }));
      hasBlocker = true;
    } else {
      normalizedStatus = row.status;
    }
  } else {
    normalizedStatus = null;
  }

  if (!row.ticketUrl) {
    warnings.push(makeIssue("missing_ticket_info", "No ticket information provided.", { severity: "warning" }));
  }

  if (row.sourceUrl) {
    try {
      const parsed = new URL(row.sourceUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        warnings.push(makeIssue("invalid_source_url", `Source URL uses unsupported protocol: ${parsed.protocol}`, { field: "sourceUrl" }));
      }
    } catch {
      warnings.push(makeIssue("invalid_source_url", `Source URL is not a valid URL: ${row.sourceUrl}`, { field: "sourceUrl" }));
    }
  }

  if (hasBlocker) {
    return {
      matchResult: "blocked",
      warnings,
      homeParticipantResolvedId: home.clubId,
      awayParticipantResolvedId: away.clubId,
      competitionResolvedCode: competitionCode,
      venueResolvedId: venue.venueId,
      normalizedDate,
      normalizedTime,
      normalizedStatus,
      awayIsOneOff: resolvedAwayIsOneOff,
      awayParticipantRaw: row.awayParticipantRaw,
    };
  }

  const resolvedRow = {
    ...row,
    homeParticipantResolvedId: home.clubId,
    awayParticipantResolvedId: away.clubId,
    competitionResolvedCode: competitionCode,
    venueResolvedId: venue.venueId,
    kickoffDate: normalizedDate ?? row.kickoffDate,
    kickoffTime: normalizedTime ?? row.kickoffTime,
    awayIsOneOff: resolvedAwayIsOneOff,
  } as ImportBatchRow;

  const existingMatch = await findImportFixtureMatch(db, resolvedRow, seasonLabel);

  if (existingMatch.kind === "ambiguous") {
    warnings.push(makeIssue("ambiguous_fixture_match",
      `Found ${existingMatch.count} existing fixtures matching this row. Cannot determine which to update.`,
      { severity: "blocker" }
    ));
    return {
      matchResult: "blocked",
      warnings,
      homeParticipantResolvedId: home.clubId,
      awayParticipantResolvedId: away.clubId,
      competitionResolvedCode: competitionCode,
      venueResolvedId: venue.venueId,
      normalizedDate,
      normalizedTime,
      normalizedStatus,
      awayIsOneOff: resolvedAwayIsOneOff,
      awayParticipantRaw: row.awayParticipantRaw,
    };
  }

  // Duplicate detection — check after resolution is complete.
  // resolvedRow was already built above for findImportFixtureMatch.
  // Order: same-batch → fixture match (canonical) → other-batch → insert/update

  const sameBatchDup = await findDuplicateInSameBatch(db, resolvedRow);
  if (sameBatchDup) {
    warnings.push(makeIssue("duplicate_same_batch", `Duplicate row — matches row #${sameBatchDup} in this batch.`, { severity: "warning" }));
    return {
      matchResult: "duplicate_same_batch",
      warnings,
      homeParticipantResolvedId: home.clubId,
      awayParticipantResolvedId: away.clubId,
      competitionResolvedCode: competitionCode,
      venueResolvedId: venue.venueId,
      normalizedDate,
      normalizedTime,
      normalizedStatus,
      awayIsOneOff: resolvedAwayIsOneOff,
      awayParticipantRaw: row.awayParticipantRaw,
    };
  }

  // Check existing fixture first — if it matches with no changes, it's duplicate
  if (existingMatch.kind === "match" && !hasMeaningfulChanges(resolvedRow, existingMatch.before)) {
    warnings.push(makeIssue("duplicate_existing_fixture", `Already imported as fixture #${existingMatch.id}. No material changes detected.`, { severity: "warning" }));
    return {
      matchResult: "duplicate_existing_fixture",
      warnings,
      homeParticipantResolvedId: home.clubId,
      awayParticipantResolvedId: away.clubId,
      competitionResolvedCode: competitionCode,
      venueResolvedId: venue.venueId,
      normalizedDate,
      normalizedTime,
      normalizedStatus,
      awayIsOneOff: resolvedAwayIsOneOff,
      awayParticipantRaw: row.awayParticipantRaw,
    };
  }

  // Check other pending batches (only when no existing fixture, or fixture has changes)
  const otherBatchDup = existingMatch.kind !== "match" ? await findDuplicateBatchRow(db, resolvedRow, row.id) : null;
  if (otherBatchDup) {
    warnings.push(makeIssue("duplicate_pending_batch", `Already in batch #${otherBatchDup.batchId} (row ${otherBatchDup.rowId}).`, { severity: "warning" }));
    return {
      matchResult: "duplicate_pending_batch",
      warnings,
      homeParticipantResolvedId: home.clubId,
      awayParticipantResolvedId: away.clubId,
      competitionResolvedCode: competitionCode,
      venueResolvedId: venue.venueId,
      normalizedDate,
      normalizedTime,
      normalizedStatus,
      awayIsOneOff: resolvedAwayIsOneOff,
      awayParticipantRaw: row.awayParticipantRaw,
    };
  }

  return {
    matchResult: existingMatch.kind === "match" ? "update" : "insert",
    warnings,
    homeParticipantResolvedId: home.clubId,
    awayParticipantResolvedId: away.clubId,
    competitionResolvedCode: competitionCode,
    venueResolvedId: venue.venueId,
    normalizedDate,
    normalizedTime,
    normalizedStatus,
    awayIsOneOff: resolvedAwayIsOneOff,
    awayParticipantRaw: row.awayParticipantRaw,
  };
}

