import type { AppDatabase } from "../../db/adapter.ts";
import type { ValidationCache } from "../validationCache.ts";
import type { ValidationContext } from "../validationContext.ts";
import type { ImportBatchRow } from "../types.ts";
import { findDuplicateBatchRow, findDuplicateInSameBatch, findRelaxedDuplicateInSameBatch, hasMeaningfulChanges } from "../validation.ts";
import { makeIssue } from "../validation.ts";
import { findExistingFixtureDuplicateByParticipantsAndDate } from "../fixtureIdentity.ts";

export async function detectDuplicates(
  db: AppDatabase,
  cache: ValidationCache,
  ctx: ValidationContext,
  seenBatchKeysStrict: Set<string>,
  seenBatchKeysRelaxed: Set<string>
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

  // Same-batch duplicate detection (strict: home, away, date, time, venue, competition)
  if (seenBatchKeysStrict.size > 0) {
    const sameBatchKey = buildSameBatchKey(resolvedRow);
    if (sameBatchKey && seenBatchKeysStrict.has(sameBatchKey)) {
      ctx.warnings.push(makeIssue("duplicate_same_batch", `Duplicate row in this batch (matching home, away, date, time, venue, competition).`, { severity: "warning" }));
      ctx.duplicateKind = "same_batch";
      ctx.duplicateRef = null;
      return;
    }
    if (sameBatchKey) {
      seenBatchKeysStrict.add(sameBatchKey);
    }

    // Relaxed same-batch: home, away, and date only
    const relaxedKey = buildRelaxedSameBatchKey(resolvedRow);
    if (relaxedKey && seenBatchKeysRelaxed.has(relaxedKey)) {
      ctx.warnings.push(makeIssue("duplicate_same_batch", `Duplicate row in this batch (matching home, away, and date).`, { severity: "warning" }));
      ctx.duplicateKind = "same_batch";
      ctx.duplicateRef = null;
      return;
    }
    if (relaxedKey) {
      seenBatchKeysRelaxed.add(relaxedKey);
    }
  } else {
    const dupRowId = await findDuplicateInSameBatch(db, ctx.row);
    if (dupRowId) {
      ctx.warnings.push(makeIssue("duplicate_same_batch", `Duplicate row in this batch (row #${dupRowId}).`, { severity: "warning" }));
      ctx.duplicateKind = "same_batch";
      ctx.duplicateRef = dupRowId;
      return;
    }

    // Relaxed same-batch (single-row mode): query DB for earlier unresolved rows with same home, away, date
    const relaxedDupRowId = await findRelaxedDuplicateInSameBatch(db, ctx.row);
    if (relaxedDupRowId) {
      ctx.warnings.push(makeIssue("duplicate_same_batch", `Duplicate row in this batch (row #${relaxedDupRowId}).`, { severity: "warning" }));
      ctx.duplicateKind = "same_batch";
      ctx.duplicateRef = relaxedDupRowId;
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

  // Relaxed existing-fixture duplicate check: same home, away, and date only
  // (ignores season, competition, time, venue)
  if (ctx.fixtureMatchKind !== "match") {
    const relaxedMatch = await findExistingFixtureDuplicateByParticipantsAndDate(db, resolvedRow);
    if (relaxedMatch.kind === "match") {
      if (!hasMeaningfulChanges(resolvedRow, relaxedMatch.before)) {
        ctx.warnings.push(makeIssue("duplicate_existing_fixture", `Already imported as fixture #${relaxedMatch.id} (matched by home, away, and date). No material changes detected.`, { severity: "warning" }));
        ctx.duplicateKind = "existing_fixture";
        ctx.duplicateRef = relaxedMatch.id;
        return;
      }
      // Meaningful changes detected → treat as update
      ctx.fixtureMatchKind = "match";
      ctx.fixtureMatchId = relaxedMatch.id;
      ctx.fixtureMatchBefore = relaxedMatch.before;
      return;
    }
    if (relaxedMatch.kind === "ambiguous") {
      ctx.warnings.push(makeIssue("ambiguous_fixture_match",
        `Found ${relaxedMatch.count} existing fixtures with the same home, away, and date. Cannot determine which this row duplicates or updates.`,
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

function buildRelaxedSameBatchKey(row: ImportBatchRow): string | null {
  if (!row.homeParticipantRaw || !row.awayParticipantRaw || !row.kickoffDate) return null;
  return `relaxed|${row.homeParticipantRaw}|${row.awayParticipantRaw}|${row.kickoffDate}`;
}