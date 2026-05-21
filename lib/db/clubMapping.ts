import type { AppDatabase } from "./adapter.ts";

export interface ClubMappingResult {
  publicClubId: number | null;
  mappingType: "direct" | "alias" | "ambiguous" | "unknown";
  displayName: string;
}

export interface ClubAlias {
  id: number;
  clubId: number;
  alias: string;
  normalizedAlias: string;
  competitionCode: string | null;
  source: string;
  createdAt: string;
  retiredAt: string | null;
}

export interface AmbiguousAliasGroup {
  normalizedAlias: string;
  competitionCode: string | null;
  clubs: Array<{ clubId: number; clubName: string; aliasId: number }>;
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
    return { publicClubId: null, mappingType: "unknown", displayName: teamName };
  }

  // 1. Try direct match on clubs
  const directClub = await db.get<{ id: number }>(
    `SELECT id FROM clubs WHERE name = ?`,
    [trimmed]
  );
  if (directClub) {
    return {
      publicClubId: directClub.id,
      mappingType: "direct",
      displayName: trimmed,
    };
  }

  // 2. Try scoped alias if competition is known (scoped wins over global)
  if (options?.competitionCode) {
    const aliasMatch = await db.get<{ club_id: number; name: string }>(
      `SELECT c.id AS club_id, c.name
       FROM clubs c
       JOIN club_aliases ca ON ca.club_id = c.id
       WHERE ca.normalized_alias = ?
         AND (ca.competition_code = ? OR ca.competition_code IS NULL)
         AND ca.retired_at IS NULL
       ORDER BY CASE WHEN ca.competition_code = ? THEN 0 ELSE 1 END
       LIMIT 1`,
      [normalizeName(trimmed), options.competitionCode, options.competitionCode]
    );
    if (aliasMatch) {
      return {
        publicClubId: aliasMatch.club_id,
        mappingType: "alias",
        displayName: aliasMatch.name,
      };
    }
  }

  // 3. Try unscoped aliases
  const aliasMatch = await db.get<{ club_id: number; name: string }>(
    `SELECT c.id AS club_id, c.name
     FROM clubs c
     JOIN club_aliases ca ON ca.club_id = c.id
     WHERE ca.normalized_alias = ? AND ca.competition_code IS NULL AND ca.retired_at IS NULL`,
    [normalizeName(trimmed)]
  );
  if (aliasMatch) {
    return {
      publicClubId: aliasMatch.club_id,
      mappingType: "alias",
      displayName: aliasMatch.name,
    };
  }

  return { publicClubId: null, mappingType: "unknown", displayName: trimmed };
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

  // If home club is known, look up their competition via division assignment
  if (homeClubId) {
    const mapping = await db.get<{ competition_code: string }>(
      `SELECT dcm.competition_code
       FROM division_assignments da
       JOIN division_competition_mappings dcm ON dcm.division_id = da.division_id
       WHERE da.club_id = ?`,
      [homeClubId]
    );
    if (mapping) return mapping.competition_code;
  }

  return null;
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[''']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function listAliasesForClub(db: AppDatabase, clubId: number): Promise<ClubAlias[]> {
  const rows = await db.all<Record<string, unknown>>(
    `SELECT id, club_id, alias, normalized_alias, competition_code, source, created_at, retired_at
     FROM club_aliases WHERE club_id = ? ORDER BY retired_at IS NULL DESC, created_at DESC`,
    [clubId]
  );
  return rows.map((row) => ({
    id: row.id as number,
    clubId: row.club_id as number,
    alias: row.alias as string,
    normalizedAlias: row.normalized_alias as string,
    competitionCode: (row.competition_code as string) ?? null,
    source: row.source as string,
    createdAt: row.created_at as string,
    retiredAt: (row.retired_at as string) ?? null,
  }));
}

export async function addAlias(
  db: AppDatabase,
  clubId: number,
  alias: string,
  options?: { competitionCode?: string; source?: string }
): Promise<ClubAlias> {
  const normalized = normalizeName(alias);

  if (!normalized) {
    throw new Error("Alias cannot be empty or contain only whitespace.");
  }

  const club = await db.get<{ name: string }>(`SELECT name FROM clubs WHERE id = ?`, [clubId]);
  if (!club) {
    throw new Error("Club not found.");
  }

  if (options?.competitionCode) {
    const comp = await db.get<{ code: string }>(`SELECT code FROM competitions WHERE code = ?`, [options.competitionCode]);
    if (!comp) {
      throw new Error(`Competition code "${options.competitionCode}" not found.`);
    }
  }

  if (!options?.competitionCode) {
    const existing = await db.get<{ id: number }>(
      `SELECT id FROM club_aliases WHERE normalized_alias = ? AND competition_code IS NULL AND retired_at IS NULL`,
      [normalized]
    );
    if (existing) {
      throw new Error("An unscoped alias with this name already exists.");
    }
  }

  const result = await db.run(
    `INSERT INTO club_aliases (club_id, alias, normalized_alias, competition_code, source)
     VALUES (?, ?, ?, ?, ?)`,
    [clubId, alias, normalized, options?.competitionCode ?? null, options?.source ?? "manual"]
  );

  const row = await db.get<Record<string, unknown>>(
    `SELECT id, club_id, alias, normalized_alias, competition_code, source, created_at, retired_at
     FROM club_aliases WHERE id = ?`,
    [result.lastInsertRowid ?? 0]
  );

  if (!row) {
    throw new Error("Failed to retrieve created alias.");
  }

  return {
    id: row.id as number,
    clubId: row.club_id as number,
    alias: row.alias as string,
    normalizedAlias: row.normalized_alias as string,
    competitionCode: (row.competition_code as string) ?? null,
    source: row.source as string,
    createdAt: row.created_at as string,
    retiredAt: (row.retired_at as string) ?? null,
  };
}

export async function retireAlias(db: AppDatabase, aliasId: number, clubId: number): Promise<void> {
  await db.run(
    `UPDATE club_aliases SET retired_at = CURRENT_TIMESTAMP WHERE id = ? AND club_id = ? AND retired_at IS NULL`,
    [aliasId, clubId]
  );
}

export async function findAmbiguousAliases(db: AppDatabase): Promise<AmbiguousAliasGroup[]> {
  const rows = await db.all<{ normalized_alias: string; competition_code: string | null; club_id: number; alias_id: number; club_name: string }>(
    `SELECT ca.normalized_alias, ca.competition_code, ca.club_id, ca.id AS alias_id, c.name AS club_name
     FROM club_aliases ca
     JOIN clubs c ON c.id = ca.club_id
     WHERE ca.retired_at IS NULL
     ORDER BY ca.normalized_alias, ca.competition_code IS NULL DESC, ca.competition_code, c.name`
  );

  const groups = new Map<string, AmbiguousAliasGroup>();

  for (const row of rows) {
    const key = `${row.normalized_alias}::${row.competition_code ?? "__unscoped__"}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        normalizedAlias: row.normalized_alias,
        competitionCode: row.competition_code ?? null,
        clubs: [],
      };
      groups.set(key, group);
    }
    group.clubs.push({
      clubId: row.club_id,
      clubName: row.club_name,
      aliasId: row.alias_id,
    });
  }

  return Array.from(groups.values()).filter((g) => g.clubs.length > 1);
}
