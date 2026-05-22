import type { ValidationCache } from "../validationCache.ts";
import type { ValidationContext } from "../validationContext.ts";
import { resolveClubParticipant, findAmbiguousClubsForAlias } from "../validationCache.ts";
import { makeIssue } from "../validation.ts";

export async function resolveHomeParticipant(cache: ValidationCache, ctx: ValidationContext): Promise<void> {
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

  const resolved = resolveClubParticipant(cache, row.homeParticipantRaw, ctx.competitionCode);

  if (resolved.mappingType === "ambiguous") {
    const clubs = findAmbiguousClubsForAlias(cache, row.homeParticipantRaw, ctx.competitionCode);
    const names = clubs.map((c) => c.name).join(", ");
    ctx.warnings.push(makeIssue("ambiguous_club", `Ambiguous alias matches ${clubs.length} clubs: ${names}`, { field: "home", rawValue: row.homeParticipantRaw }));
    ctx.hasBlocker = true;
    return;
  }

  if (resolved.mappingType === "unknown") {
    ctx.warnings.push(makeIssue("unknown_club", `Unknown club: ${row.homeParticipantRaw}. Verify the club name or add an alias.`, { field: "home", rawValue: row.homeParticipantRaw }));
    ctx.hasBlocker = true;
    return;
  }

  ctx.homeClubId = resolved.clubId;
}

export async function resolveAwayParticipant(cache: ValidationCache, ctx: ValidationContext): Promise<void> {
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

  const resolved = resolveClubParticipant(cache, row.awayParticipantRaw, ctx.competitionCode);

  if (resolved.mappingType === "ambiguous") {
    const clubs = findAmbiguousClubsForAlias(cache, row.awayParticipantRaw, ctx.competitionCode);
    const names = clubs.map((c) => c.name).join(", ");
    ctx.warnings.push(makeIssue("ambiguous_club", `Ambiguous alias matches ${clubs.length} clubs: ${names}`, { field: "away", rawValue: row.awayParticipantRaw }));
    ctx.hasBlocker = true;
    return;
  }

  if (resolved.mappingType === "unknown") {
    const friendlyOverride = ctx.competitionKind === "friendly" && row.awayParticipantRaw;
    if (friendlyOverride) {
      ctx.resolvedAwayIsOneOff = true;
      return;
    }
    ctx.warnings.push(makeIssue("unknown_club", `Unknown club: ${row.awayParticipantRaw}. Verify the club name or add an alias.`, { field: "away", rawValue: row.awayParticipantRaw }));
    ctx.hasBlocker = true;
    return;
  }

  ctx.awayClubId = resolved.clubId;
}