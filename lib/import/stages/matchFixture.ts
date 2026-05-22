import type { AppDatabase } from "../../db/adapter.ts";
import type { ValidationContext } from "../validationContext.ts";
import type { ImportBatchRow } from "../types.ts";
import { findImportFixtureMatch } from "../fixtureIdentity.ts";
import { makeIssue } from "../validation.ts";

export async function matchFixture(db: AppDatabase, ctx: ValidationContext): Promise<void> {
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

  const existingMatch = await findImportFixtureMatch(db, resolvedRow, ctx.seasonLabel);

  ctx.fixtureMatchKind = existingMatch.kind;
  if (existingMatch.kind === "match") {
    ctx.fixtureMatchId = existingMatch.id;
    ctx.fixtureMatchBefore = existingMatch.before;
  }

  if (existingMatch.kind === "ambiguous") {
    ctx.warnings.push(makeIssue("ambiguous_fixture_match",
      `Found ${existingMatch.count} existing fixtures matching this row. Cannot determine which to update.`,
      { severity: "blocker" }
    ));
    ctx.hasBlocker = true;
  }
}
