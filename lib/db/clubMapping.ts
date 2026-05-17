import type { AppDatabase } from "./adapter.ts";

export interface ClubMappingResult {
  publicClubId: number | null;
  pyramidClubId: number | null;
  mappingType: "direct" | "canonical" | "alias" | "source_id" | "one_off" | "ambiguous" | "unknown";
  displayName: string;
}

export interface CompetitionMappingResult {
  competitionCode: string | null;
  divisionId: number | null;
}

export async function resolveFixtureParticipant(
  db: AppDatabase,
  teamName: string,
  options?: {
    sourceId?: string;
    competitionCode?: string;
    seasonLabel?: string;
  }
): Promise<ClubMappingResult> {
  const trimmed = teamName.trim();
  if (!trimmed) {
    return { publicClubId: null, pyramidClubId: null, mappingType: "unknown", displayName: teamName };
  }

  // 1. Try canonical match on clubs
  const directClub = await db.get<{ id: number }>(
    `SELECT id FROM clubs WHERE name = ?`,
    [trimmed]
  );
  if (directClub) {
    const pyramid = await db.get<{ pyramid_club_id: number }>(
      `SELECT pyramid_club_id FROM club_mappings WHERE club_id = ?`,
      [directClub.id]
    );
    return {
      publicClubId: directClub.id,
      pyramidClubId: pyramid?.pyramid_club_id ?? null,
      mappingType: "direct",
      displayName: trimmed
    };
  }

  // 2. Try pyramid club name (needs mapping to public club)
  const pyramidClub = await db.get<{ id: number; name: string }>(
    `SELECT id, name FROM pyramid_clubs WHERE name = ?`,
    [trimmed]
  );
  if (pyramidClub) {
    const mapping = await db.get<{ club_id: number }>(
      `SELECT club_id FROM club_mappings WHERE pyramid_club_id = ?`,
      [pyramidClub.id]
    );
    if (mapping) {
      return {
        publicClubId: mapping.club_id,
        pyramidClubId: pyramidClub.id,
        mappingType: "canonical",
        displayName: pyramidClub.name
      };
    }
    return {
      publicClubId: null,
      pyramidClubId: pyramidClub.id,
      mappingType: "unknown",
      displayName: pyramidClub.name
    };
  }

  // 3. Try scoped alias if competition is known
  if (options?.competitionCode) {
    const aliasMatch = await db.get<{ club_id: number; name: string }>(
      `SELECT c.id AS club_id, c.name
       FROM clubs c
       JOIN club_aliases ca ON ca.club_id = c.id
       WHERE ca.normalized_alias = ? AND (ca.competition_code = ? OR ca.competition_code IS NULL)`,
      [normalizeName(trimmed), options.competitionCode]
    );
    if (aliasMatch) {
      return {
        publicClubId: aliasMatch.club_id,
        pyramidClubId: null,
        mappingType: "alias",
        displayName: aliasMatch.name
      };
    }
  }

  // 4. Try unscoped aliases
  const aliasMatch = await db.get<{ club_id: number; name: string }>(
    `SELECT c.id AS club_id, c.name
     FROM clubs c
     JOIN club_aliases ca ON ca.club_id = c.id
     WHERE ca.normalized_alias = ? AND ca.competition_code IS NULL`,
    [normalizeName(trimmed)]
  );
  if (aliasMatch) {
    return {
      publicClubId: aliasMatch.club_id,
      pyramidClubId: null,
      mappingType: "alias",
      displayName: aliasMatch.name
    };
  }

  return { publicClubId: null, pyramidClubId: null, mappingType: "unknown", displayName: trimmed };
}

export async function resolveCompetitionFromDivision(
  db: AppDatabase,
  divisionId: number
): Promise<CompetitionMappingResult | null> {
  const row = await db.get<{ competition_code: string; division_id: number }>(
    `SELECT competition_code, division_id FROM division_competition_mappings WHERE division_id = ?`,
    [divisionId]
  );
  return row ? { competitionCode: row.competition_code, divisionId: row.division_id } : null;
}

export async function resolveCompetitionFromFixture(
  db: AppDatabase,
  homeClubId: number | null,
  competitionText: string
): Promise<string | null> {
  // First try exact match on competitions table
  const comp = await db.get<{ code: string }>(
    `SELECT code FROM competitions WHERE code = ? OR name = ?`,
    [competitionText, competitionText]
  );
  if (comp) return comp.code;

  // If home club is known, look up their current competition
  if (homeClubId) {
    const club = await db.get<{ competition_code: string }>(
      `SELECT competition_code FROM clubs WHERE id = ?`,
      [homeClubId]
    );
    if (club) return club.competition_code;
  }

  return null;
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
