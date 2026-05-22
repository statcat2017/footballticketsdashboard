import type { AppDatabase } from "../../db/adapter.ts";
import type { ValidationCache } from "../validationCache.ts";
import type { ValidationContext } from "../validationContext.ts";
import type { ImportBatchRow } from "../types.ts";
import { findDuplicateBatchRow, findDuplicateInSameBatch, hasMeaningfulChanges } from "../validation.ts";
import { makeIssue } from "../validation.ts";
import { findExistingFixtureDuplicateByParticipantsAndDate } from "../fixtureIdentity.ts";

export async function detectDuplicates(
  db: AppDatabase,
  cache: ValidationCache,
  ctx: ValidationContext,
  seenBatchKeys: Set<string>
): Promise<void> {
  const resolvedRow = {
    ...ctx.row,
    homeParticipantResolvedId: ctx.homeClubId,
    awayParticipantResolvedId: ctx.awayClubId,
    competitionResolvedCode: ctx.competitionCode,
    venueResolvedId: ctx.venueId,
    kickoffDate: ctx.normalizedDate ?? ctx.row.kickoffDate,
    kickoffTime: ctx.normalizedTime ?? ctx.row.kickoffTime,
    awayIsOneOff: ctx.resolvedAwayIsOneOff,
  } as ImportBatchRow;

  // Same-batch duplicate detection
  if (seenBatchKeys.size > 0) {
    // Batch mode: use in-memory set
    const sameBatchKey = buildSameBatchKey(resolvedRow);
    if (sameBatchKey && seenBatchKeys.has(sameBatchKey)) {
      ctx.warnings.push(makeIssue("duplicate_same_batch", `Duplicate row in this batch (matching home, away, date, time, venue, competition).`, { severity: "warning" }));
      ctx.duplicateKind = "same_batch";
      ctx.duplicateRef = null;
      return;
    }
    if (sameBatchKey) {
      seenBatchKeys.add(sameBatchKey);
    }
  } else {
    // Single-row mode: query DB for earlier unresolved rows in the same batch
    const dupRowId = await findDuplicateInSameBatch(db, ctx.row);
    if (dupRowId) {
      ctx.warnings.push(makeIssue("duplicate_same_batch", `Duplicate row in this batch (row #${dupRowId}).`, { severity: "warning" }));
      ctx.duplicateKind = "same_batch";
      ctx.duplicateRef = dupRowId;
      return;
    }
  }

  if (ctx.fixtureMatchKind === "match" && ctx.fixtureMatchBefore && !hasMeaningfulChanges(resolvedRow, ctx.fixtureMatchBefore)) {
    ctx.warnings.push(makeIssue("duplicate_existing_fixture", `Already imported as fixture #${ctx.fixtureMatchId}. No material changes detected.`, { severity: "warning" }));
    ctx.duplicateKind = "existing_fixture";
    ctx.duplicateRef = ctx.fixtureMatchId;
    return;
  }

  if (ctx.fixtureMatchKind !== "match") {
    const otherBatchDup = await findDuplicateBatchRow(db, resolvedRow, ctx.row.id);
    if (otherBatchDup) {
      ctx.warnings.push(makeIssue("duplicate_pending_batch", `Already in batch #${otherBatchDup.batchId} (row ${otherBatchDup.rowId}).`, { severity: "warning" }));
      ctx.duplicateKind = "pending_batch";
      ctx.duplicateRef = otherBatchDup;
      return;
    }
  }

  // Relaxed duplicate check: same home, away, and date only (ignore season, competition, time)
  if (ctx.fixtureMatchKind !== "match") {
    const relaxedMatch = await findExistingFixtureDuplicateByParticipantsAndDate(db, resolvedRow);
    if (relaxedMatch.kind === "match") {
      ctx.warnings.push(makeIssue("duplicate_existing_fixture", `Already imported as fixture #${relaxedMatch.id} (matched by home, away, and date).`, { severity: "warning" }));
      ctx.duplicateKind = "existing_fixture";
      ctx.duplicateRef = relaxedMatch.id;
      return;
    }
    if (relaxedMatch.kind === "ambiguous") {
      ctx.warnings.push(makeIssue("ambiguous_fixture_match",
        `Found ${relaxedMatch.count} existing fixtures with the same home, away, and date. Cannot determine which this row duplicates.`,
        { severity: "blocker" }
      ));
      ctx.hasBlocker = true;
      return;
    }
  }
}

function buildSameBatchKey(row: ImportBatchRow): string | null {
  if (!row.homeParticipantRaw || !row.awayParticipantRaw || !row.kickoffDate) return null;
  return `${row.homeParticipantRaw}|${row.awayParticipantRaw}|${row.kickoffDate}|${row.kickoffTime ?? ""}|${row.venueRaw ?? ""}|${row.competitionRaw ?? ""}`;
}