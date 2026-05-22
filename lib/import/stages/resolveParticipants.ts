import type { AppDatabase } from "../../db/adapter.ts";
import type { ValidationContext } from "../validationContext.ts";
import { resolveFixtureParticipant, normalizeName } from "../../db/clubMapping.ts";
import { makeIssue } from "../validation.ts";

export async function resolveHomeParticipant(db: AppDatabase, ctx: ValidationContext): Promise<void> {
  const { row } = ctx;

  if (!row.homeParticipantRaw) {
    if (!row.homeIsOneOff) {
      ctx.warnings.push(makeIssue("missing_participant", "Missing home participant", { field: "home" }));
      ctx.hasBlocker = true;
    }
    return;
  }

  if (row.homeIsOneOff) {
    return;
  }

  const normalized = normalizeName(row.homeParticipantRaw);

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
    ctx.warnings.push(makeIssue("ambiguous_club", `Ambiguous alias matches ${clubs.length} clubs: ${names}`, { field: "home", rawValue: row.homeParticipantRaw }));
    ctx.hasBlocker = true;
    return;
  }

  const resolved = await resolveFixtureParticipant(db, row.homeParticipantRaw);

  if (resolved.mappingType === "unknown" || resolved.mappingType === "ambiguous") {
    ctx.warnings.push(makeIssue("unknown_club", `Unknown club: ${row.homeParticipantRaw}. Verify the club name or add an alias.`, { field: "home", rawValue: row.homeParticipantRaw }));
    ctx.hasBlocker = true;
    return;
  }

  ctx.homeClubId = resolved.publicClubId;
}

export async function resolveAwayParticipant(db: AppDatabase, ctx: ValidationContext): Promise<void> {
  const { row } = ctx;

  if (!row.awayParticipantRaw) {
    if (!row.awayIsOneOff) {
      ctx.warnings.push(makeIssue("missing_participant", "Missing away participant", { field: "away" }));
      ctx.hasBlocker = true;
    }
    return;
  }

  if (row.awayIsOneOff) {
    return;
  }

  const normalized = normalizeName(row.awayParticipantRaw);

  if (ctx.competitionCode) {
    const scopedMatches = await db.all<{ club_id: number }>(
      `SELECT ca.club_id FROM club_aliases ca
       WHERE ca.normalized_alias = ? AND ca.retired_at IS NULL
         AND ca.competition_code = ?`,
      [normalized, ctx.competitionCode]
    );
    if (scopedMatches.length > 1) {
      const clubs = await db.all<{ name: string }>(
        `SELECT c.name FROM clubs c
         JOIN club_aliases ca ON ca.club_id = c.id
         WHERE ca.normalized_alias = ? AND ca.retired_at IS NULL
           AND ca.competition_code = ?`,
        [normalized, ctx.competitionCode]
      );
      const names = clubs.map((c) => c.name).join(", ");
      ctx.warnings.push(makeIssue("ambiguous_club", `Ambiguous alias matches ${clubs.length} clubs: ${names}`, { field: "away", rawValue: row.awayParticipantRaw }));
      ctx.hasBlocker = true;
      return;
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
      ctx.warnings.push(makeIssue("ambiguous_club", `Ambiguous alias matches ${clubs.length} clubs: ${names}`, { field: "away", rawValue: row.awayParticipantRaw }));
      ctx.hasBlocker = true;
      return;
    }
  }

  const resolved = await resolveFixtureParticipant(db, row.awayParticipantRaw, {
    competitionCode: ctx.competitionCode ?? undefined,
  });

  if (resolved.mappingType === "unknown" || resolved.mappingType === "ambiguous") {
    const friendlyOverride = ctx.competitionKind === "friendly" && row.awayParticipantRaw;
    if (friendlyOverride) {
      ctx.resolvedAwayIsOneOff = true;
      return;
    }
    ctx.warnings.push(makeIssue("unknown_club", `Unknown club: ${row.awayParticipantRaw}. Verify the club name or add an alias.`, { field: "away", rawValue: row.awayParticipantRaw }));
    ctx.hasBlocker = true;
    return;
  }

  ctx.awayClubId = resolved.publicClubId;
}
