import type { AppDatabase } from "../db/adapter.ts";
import type { ImportBatchRow, MatchResult, FixtureStatus, WarningIssue, IssueCode } from "./types.ts";
import {
  resolveFixtureParticipant,
  resolveCompetitionFromFixture,
  normalizeName,
} from "../db/clubMapping.ts";
import { getBatch, getBatchRows, updateBatchRowOutcome } from "./importBatch.ts";
import { parseDateField, parseTimeField } from "./adapters/csv.ts";

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
  batchId: number
): Promise<BatchValidationResult> {
  const batch = await getBatch(db, batchId);
  if (!batch) throw new Error(`Import batch ${batchId} not found.`);

  const rows = await getBatchRows(db, batchId);

  const seasonLabel = (batch.seasonLabel ?? await getCurrentSeasonLabel(db)) ?? null;

  let insertCount = 0;
  let updateCount = 0;
  let blockedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    if (row.finalAction) {
      skippedCount++;
      continue;
    }

    const validation = await validateRow(db, row, seasonLabel);

    const payload = validation.warnings.length > 0 ? buildWarningsPayload(validation.warnings) : undefined;
    const outcomeUpdate: Parameters<typeof updateBatchRowOutcome>[2] = {
      matchResult: validation.matchResult,
      warnings: payload,
      homeParticipantResolvedId: validation.homeParticipantResolvedId,
      awayParticipantResolvedId: validation.awayParticipantResolvedId,
      awayIsOneOff: validation.awayIsOneOff,
      competitionResolvedCode: validation.competitionResolvedCode,
      venueResolvedId: validation.venueResolvedId,
    };

    if (validation.normalizedDate !== undefined) {
      outcomeUpdate.kickoffDate = validation.normalizedDate;
    }
    if (validation.normalizedTime !== undefined) {
      outcomeUpdate.kickoffTime = validation.normalizedTime;
    }
    if (validation.normalizedStatus !== undefined) {
      outcomeUpdate.status = validation.normalizedStatus;
    }

    await updateBatchRowOutcome(db, row.id, outcomeUpdate);

    if (validation.matchResult === "insert") insertCount++;
    else if (validation.matchResult === "update") updateCount++;
    else if (validation.matchResult === "blocked") blockedCount++;
    else skippedCount++;
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

async function getCurrentSeasonLabel(db: AppDatabase): Promise<string | undefined> {
  const season = await db.get<{ label: string }>(
    `SELECT label FROM fixture_seasons WHERE is_current = 1 LIMIT 1`
  );
  return season?.label;
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + "T00:00:00Z").getUTCDay();
  return day === 0 || day === 6;
}

function getAssumedKickoffTime(dateStr: string): string {
  return isWeekend(dateStr) ? "15:00" : "19:45";
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
    warnings.push(makeIssue("unknown_competition", `Unknown competition: ${competitionRaw}. Publish the division first.`, { rawValue: competitionRaw }));
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
      const club = await db.get<{ venue_id: number }>(
        `SELECT venue_id FROM clubs WHERE id = ?`,
        [homeClubId]
      );
      if (club?.venue_id) {
        warnings.push(makeIssue("venue_not_found", `Venue "${venueRaw}" not found. Using home club's primary venue.`, { field: "venue", rawValue: venueRaw }));
        return { venueId: club.venue_id, warnings, isBlocked: false };
      }
    }
    return { venueId: null, warnings: [makeIssue("venue_not_found", `Venue "${venueRaw}" not found and home club has no primary venue.`, { rawValue: venueRaw })], isBlocked: true };
  }

  if (homeIsOneOff) {
    return { venueId: null, warnings: [makeIssue("one_off_needs_venue", "One-off home participant needs an explicit venue.")], isBlocked: true };
  }

  if (homeClubId) {
    const club = await db.get<{ venue_id: number }>(
      `SELECT venue_id FROM clubs WHERE id = ?`,
      [homeClubId]
    );
    if (club?.venue_id) {
      return { venueId: club.venue_id, warnings, isBlocked: false };
    }
  }

  return { venueId: null, warnings: [makeIssue("missing_primary_venue", "Home club has no primary venue.")], isBlocked: true };
}

const VALID_FIXTURE_STATUSES: FixtureStatus[] = ["scheduled", "postponed", "cancelled", "finished", "unknown"];

export async function validateRow(
  db: AppDatabase,
  row: ImportBatchRow,
  seasonLabel: string | null,
): Promise<RowValidationResult> {
  const warnings: ValidationWarning[] = [];
  let hasBlocker = false;

  let competitionCode: string | null = null;
  let competitionKind: string | null = null;

  const compPass1 = await resolveCompetition(db, row.competitionRaw, null);
  if (!compPass1.isBlocked) competitionCode = compPass1.code;
  else warnings.push(...compPass1.warnings.filter((w) => w.field !== undefined || compPass1.isBlocked));

  const home = await resolveParticipant(db, row.homeParticipantRaw, row.homeIsOneOff, competitionCode ?? undefined, "home");
  warnings.push(...home.warnings);
  if (home.isBlocked) hasBlocker = true;

  if (!competitionCode && home.clubId && !home.isBlocked) {
    const inferred = await resolveCompetitionFromFixture(db, home.clubId, row.competitionRaw ?? "");
    if (inferred) {
      competitionCode = inferred;
    }
  }

  if (competitionCode) {
    const comp = await db.get<{ kind: string }>(
      `SELECT kind FROM competitions WHERE code = ?`,
      [competitionCode]
    );
    competitionKind = comp?.kind ?? null;
  }

  if (!competitionCode) {
    hasBlocker = true;
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
    kickoffTime = getAssumedKickoffTime(dateStr);
    warnings.push(makeIssue("assumed_time",
      isWeekend(dateStr)
        ? "Kickoff time assumed 15:00 (weekend)."
        : "Kickoff time assumed 19:45 (midweek).",
      { severity: "warning" }
    ));
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

  const existingFixtureId = await findExistingFixtureId(db, {
    ...row,
    homeParticipantResolvedId: home.clubId,
    awayParticipantResolvedId: away.clubId,
    competitionResolvedCode: competitionCode,
    venueResolvedId: venue.venueId,
    kickoffDate: normalizedDate ?? row.kickoffDate,
    awayIsOneOff: resolvedAwayIsOneOff,
  } as ImportBatchRow, seasonLabel);

  return {
    matchResult: existingFixtureId ? "update" : "insert",
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

async function findExistingFixtureId(
  db: AppDatabase,
  row: ImportBatchRow,
  seasonLabel: string | null,
): Promise<number | null> {
  if (!row.competitionResolvedCode) return null;

  if (row.homeIsOneOff && row.awayIsOneOff) {
    const sql = `SELECT id FROM fixtures
      WHERE competition_code = ? AND season_label = ?
      AND home_one_off_name = ? AND away_one_off_name = ?`;
    const params: (string | number | null)[] = [row.competitionResolvedCode, seasonLabel, row.homeParticipantRaw, row.awayParticipantRaw];
    const result = await db.get<{ id: number }>(sql, params);
    return result?.id ?? null;
  }

  if (row.homeIsOneOff && row.awayParticipantResolvedId) {
    const result = await db.get<{ id: number }>(
      `SELECT id FROM fixtures
       WHERE competition_code = ? AND season_label = ?
       AND home_one_off_name = ? AND away_club_id = ?`,
      [row.competitionResolvedCode, seasonLabel, row.homeParticipantRaw, row.awayParticipantResolvedId]
    );
    return result?.id ?? null;
  }

  if (row.awayIsOneOff && row.homeParticipantResolvedId) {
    const result = await db.get<{ id: number }>(
      `SELECT id FROM fixtures
       WHERE competition_code = ? AND season_label = ?
       AND away_one_off_name = ? AND home_club_id = ?`,
      [row.competitionResolvedCode, seasonLabel, row.awayParticipantRaw, row.homeParticipantResolvedId]
    );
    return result?.id ?? null;
  }

  if (!row.homeParticipantResolvedId || !row.awayParticipantResolvedId) return null;

  let sql = `SELECT id FROM fixtures
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

  const fixtures = await db.all<{ id: number }>(sql, params);
  if (fixtures.length === 0) return null;
  if (fixtures.length > 1) return null;

  return fixtures[0].id;
}
