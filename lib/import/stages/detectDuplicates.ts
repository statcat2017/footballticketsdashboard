import type { AppDatabase } from "../../db/adapter.ts";
import type { ValidationContext } from "../validationContext.ts";
import type { ImportBatchRow } from "../types.ts";
import { findDuplicateInSameBatch, findDuplicateBatchRow, hasMeaningfulChanges } from "../validation.ts";
import { makeIssue } from "../validation.ts";

export async function detectDuplicates(db: AppDatabase, ctx: ValidationContext): Promise<void> {
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

  const sameBatchDup = await findDuplicateInSameBatch(db, resolvedRow);
  if (sameBatchDup) {
    ctx.warnings.push(makeIssue("duplicate_same_batch", `Duplicate row — matches row #${sameBatchDup} in this batch.`, { severity: "warning" }));
    ctx.duplicateKind = "same_batch";
    ctx.duplicateRef = sameBatchDup;
    return;
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
}
