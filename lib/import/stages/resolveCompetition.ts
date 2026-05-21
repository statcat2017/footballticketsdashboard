import type { AppDatabase } from "../../db/adapter.ts";
import type { ValidationContext } from "../validationContext.ts";
import { resolveCompetitionFromFixture } from "../../db/clubMapping.ts";
import { makeIssue } from "../validation.ts";

export async function resolveCompetition(db: AppDatabase, ctx: ValidationContext): Promise<void> {
  const { row } = ctx;

  if (row.competitionRaw) {
    const comp = await db.get<{ code: string; name: string }>(
      `SELECT code, name FROM competitions WHERE code = ? OR name = ?`,
      [row.competitionRaw, row.competitionRaw]
    );
    if (comp) {
      ctx.competitionCode = comp.code;
      const compKind = await db.get<{ kind: string }>(
        `SELECT kind FROM competitions WHERE code = ?`,
        [comp.code]
      );
      ctx.competitionKind = compKind?.kind ?? null;
      return;
    }
  }

  if (ctx.homeClubId) {
    const inferred = await resolveCompetitionFromFixture(db, ctx.homeClubId, row.competitionRaw ?? "");
    if (inferred) {
      ctx.competitionCode = inferred;
      const compKind = await db.get<{ kind: string }>(
        `SELECT kind FROM competitions WHERE code = ?`,
        [inferred]
      );
      ctx.competitionKind = compKind?.kind ?? null;
      return;
    }
  }

  if (row.competitionRaw) {
    ctx.warnings.push(makeIssue("unknown_competition", `Unknown competition: ${row.competitionRaw}. Add a competition mapping for the club's division or specify a known competition.`, { rawValue: row.competitionRaw }));
  } else {
    ctx.warnings.push(makeIssue("missing_competition", "No competition specified and could not infer from home club."));
  }
  ctx.hasBlocker = true;
}
