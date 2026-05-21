import type { ImportBatchRow, MatchResult, FixtureStatus, KickoffAssumptionPolicy } from "./types.ts";
import type { ValidationWarning, RowValidationResult } from "./validation.ts";

export interface ValidationContext {
  row: ImportBatchRow;
  seasonLabel: string | null;
  options: { kickoffAssumptionPolicy?: KickoffAssumptionPolicy };
  homeClubId: number | null;
  awayClubId: number | null;
  competitionCode: string | null;
  competitionKind: string | null;
  venueId: number | null;
  normalizedDate: string | null | undefined;
  normalizedTime: string | null | undefined;
  normalizedStatus: FixtureStatus | null | undefined;
  resolvedAwayIsOneOff: boolean;
  warnings: ValidationWarning[];
  hasBlocker: boolean;
  fixtureMatchKind: "match" | "ambiguous" | "none";
  fixtureMatchId: number | null;
  fixtureMatchBefore: Record<string, unknown> | null;
  duplicateKind: "same_batch" | "existing_fixture" | "pending_batch" | null;
  duplicateRef: number | { batchId: number; rowId: number } | null;
}

export function createContext(
  row: ImportBatchRow,
  seasonLabel: string | null,
  options?: { kickoffAssumptionPolicy?: KickoffAssumptionPolicy }
): ValidationContext {
  return {
    row,
    seasonLabel,
    options: options ?? {},
    homeClubId: null,
    awayClubId: null,
    competitionCode: null,
    competitionKind: null,
    venueId: null,
    normalizedDate: undefined,
    normalizedTime: undefined,
    normalizedStatus: undefined,
    resolvedAwayIsOneOff: row.awayIsOneOff,
    warnings: [],
    hasBlocker: false,
    fixtureMatchKind: "none",
    fixtureMatchId: null,
    fixtureMatchBefore: null,
    duplicateKind: null,
    duplicateRef: null,
  };
}

export function toResult(ctx: ValidationContext): RowValidationResult {
  let matchResult: MatchResult;
  if (ctx.hasBlocker) {
    matchResult = "blocked";
  } else if (ctx.duplicateKind === "same_batch") {
    matchResult = "duplicate_same_batch";
  } else if (ctx.duplicateKind === "existing_fixture") {
    matchResult = "duplicate_existing_fixture";
  } else if (ctx.duplicateKind === "pending_batch") {
    matchResult = "duplicate_pending_batch";
  } else if (ctx.fixtureMatchKind === "match") {
    matchResult = "update";
  } else {
    matchResult = "insert";
  }

  return {
    matchResult,
    warnings: ctx.warnings,
    homeParticipantResolvedId: ctx.homeClubId,
    awayParticipantResolvedId: ctx.awayClubId,
    competitionResolvedCode: ctx.competitionCode,
    venueResolvedId: ctx.venueId,
    normalizedDate: ctx.normalizedDate,
    normalizedTime: ctx.normalizedTime,
    normalizedStatus: ctx.normalizedStatus,
    awayIsOneOff: ctx.resolvedAwayIsOneOff,
    awayParticipantRaw: ctx.row.awayParticipantRaw,
  };
}
