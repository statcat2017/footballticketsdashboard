import type { ValidationCache } from "../validationCache.ts";
import type { ValidationContext } from "../validationContext.ts";
import { resolveCompetition as cachedResolveCompetition } from "../validationCache.ts";
import { makeIssue } from "../validation.ts";

export async function resolveCompetition(cache: ValidationCache, ctx: ValidationContext): Promise<void> {
  const { row } = ctx;

  const result = cachedResolveCompetition(cache, row.competitionRaw ?? undefined, ctx.homeClubId ?? undefined);

  if (result.code) {
    ctx.competitionCode = result.code;
    ctx.competitionKind = result.kind;
    return;
  }

  if (row.competitionRaw) {
    ctx.warnings.push(makeIssue("unknown_competition", `Unknown competition: ${row.competitionRaw}. Add a competition mapping for the club's division or specify a known competition.`, { rawValue: row.competitionRaw }));
  } else {
    ctx.warnings.push(makeIssue("missing_competition", "No competition specified and could not infer from home club."));
  }
  ctx.hasBlocker = true;
}