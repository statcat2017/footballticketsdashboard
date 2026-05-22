import type { AppDatabase } from "../db/adapter.ts";

export type ClubResolutionType = "direct" | "alias" | "ambiguous" | "unknown";

export interface ClubResolutionResult {
  clubId: number | null;
  mappingType: ClubResolutionType;
  displayName: string;
}

export interface AmbiguousClubInfo {
  name: string;
  clubId: number;
}

export interface ValidationCache {
  competitions: Array<{ code: string; name: string; tier: number; kind?: string }>;
  competitionByCode: Map<string, { code: string; name: string; tier: number; kind?: string }>;
  competitionByName: Map<string, { code: string; name: string; tier: number; kind?: string }>;
  clubs: Array<{ id: number; name: string }>;
  clubByName: Map<string, number>;
  clubAliases: Array<{
    id: number;
    club_id: number;
    normalized_alias: string;
    competition_code?: string | null;
    retired_at?: string | null;
  }>;
  // Maps normalized_alias -> list of club IDs (unscoped, for ambiguity detection)
  aliasToClubsUnscoped: Map<string, Array<{ clubId: number; clubName: string }>>;
  // Maps normalized_alias|competition_code -> club ID (scoped)
  aliasToClubScoped: Map<string, number>;
  venues: Array<{ id: number; name: string; latitude: number; longitude: number; is_approximate: number }>;
  venueByName: Map<string, number>;
  clubToPrimaryVenue: Map<number, number>;
  divisionCompetitionMap: Map<number, string>;
}

export async function createValidationCache(db: AppDatabase): Promise<ValidationCache> {
  const [competitions, clubs, clubAliases, venues, clubVenueAssignments, divisionCompetitionMapResults] =
    await Promise.all([
      db.all<{ code: string; name: string; tier: number; kind?: string }>(
        "SELECT code, name, tier, kind FROM competitions"
      ),
      db.all<{ id: number; name: string }>("SELECT id, name FROM clubs"),
      db.all<{
        id: number;
        club_id: number;
        normalized_alias: string;
        competition_code?: string | null;
        retired_at?: string | null;
      }>(
        "SELECT ca.id, ca.club_id, ca.normalized_alias, ca.competition_code, ca.retired_at " +
        "FROM club_aliases ca WHERE ca.retired_at IS NULL"
      ),
      db.all<{
        id: number;
        name: string;
        latitude: number;
        longitude: number;
        is_approximate: number
      }>("SELECT id, name, latitude, longitude, is_approximate FROM venues"),
      db.all<{
        club_id: number;
        venue_id: number
      }>(
        "SELECT club_id, venue_id FROM club_venue_assignments WHERE is_primary = 1 AND effective_to IS NULL"
      ),
      db.all<{
        club_id: number;
        competition_code: string
      }>(
        "SELECT da.club_id, dcm.competition_code " +
        "FROM division_assignments da " +
        "JOIN division_competition_mappings dcm ON dcm.division_id = da.division_id"
      )
    ]);

  const competitionByCode = new Map<string, { code: string; name: string; tier: number; kind?: string }>();
  const competitionByName = new Map<string, { code: string; name: string; tier: number; kind?: string }>();
  for (const comp of competitions) {
    competitionByCode.set(comp.code, comp);
    competitionByName.set(comp.name.toLowerCase(), comp);
  }

  const clubByName = new Map<string, number>();
  for (const club of clubs) {
    clubByName.set(club.name.toLowerCase(), club.id);
  }
  const clubById = new Map<number, string>();
  for (const club of clubs) {
    clubById.set(club.id, club.name);
  }

  const aliasToClubsUnscoped = new Map<string, Array<{ clubId: number; clubName: string }>>();
  const aliasToClubScoped = new Map<string, number>();
  for (const alias of clubAliases) {
    if (alias.competition_code === null) {
      // Unscoped - track all matches for ambiguity detection
      let entries = aliasToClubsUnscoped.get(alias.normalized_alias);
      if (!entries) {
        entries = [];
        aliasToClubsUnscoped.set(alias.normalized_alias, entries);
      }
      entries.push({ clubId: alias.club_id, clubName: clubById.get(alias.club_id) ?? `Club #${alias.club_id}` });
    } else {
      // Scoped - competition-specific, map directly
      const key = `${alias.normalized_alias}|${alias.competition_code}`;
      aliasToClubScoped.set(key, alias.club_id);
    }
  }

  const venueByName = new Map<string, number>();
  for (const venue of venues) {
    venueByName.set(venue.name.toLowerCase(), venue.id);
  }

  const clubToPrimaryVenue = new Map<number, number>();
  for (const cva of clubVenueAssignments) {
    clubToPrimaryVenue.set(cva.club_id, cva.venue_id);
  }

  const divisionCompetitionMap = new Map<number, string>();
  for (const row of divisionCompetitionMapResults) {
    divisionCompetitionMap.set(row.club_id, row.competition_code);
  }

  return {
    competitions,
    competitionByCode,
    competitionByName,
    clubs,
    clubByName,
    clubAliases,
    aliasToClubsUnscoped,
    aliasToClubScoped,
    venues,
    venueByName,
    clubToPrimaryVenue,
    divisionCompetitionMap,
  };
}

export function resolveCompetition(
  cache: ValidationCache,
  competitionRaw: string | null | undefined,
  homeClubId: number | null | undefined
): { code: string | null; kind: string | null } {
  if (!competitionRaw) {
    if (homeClubId !== null && cache.divisionCompetitionMap.has(homeClubId)) {
      const code = cache.divisionCompetitionMap.get(homeClubId)!;
      const comp = cache.competitionByCode.get(code);
      return { code, kind: comp?.kind ?? null };
    }
    return { code: null, kind: null };
  }

  const byCode = cache.competitionByCode.get(competitionRaw);
  if (byCode) {
    return { code: byCode.code, kind: byCode.kind };
  }

  const byName = cache.competitionByName.get(competitionRaw.toLowerCase());
  if (byName) {
    return { code: byName.code, kind: byName.kind };
  }

  if (homeClubId !== null && cache.divisionCompetitionMap.has(homeClubId)) {
    const code = cache.divisionCompetitionMap.get(homeClubId)!;
    const comp = cache.competitionByCode.get(code);
    return { code, kind: comp?.kind ?? null };
  }

  return { code: null, kind: null };
}

export function resolveClubParticipant(
  cache: ValidationCache,
  participantRaw: string | null | undefined,
  competitionCode: string | null | undefined
): ClubResolutionResult {
  if (!participantRaw) {
    return { clubId: null, mappingType: "unknown", displayName: "" };
  }

  const trimmed = participantRaw.trim();
  const normalized = normalizeNameForCache(trimmed);

  // 1. Try direct club name match
  const directId = cache.clubByName.get(trimmed.toLowerCase());
  if (directId !== undefined) {
    return { clubId: directId, mappingType: "direct", displayName: trimmed };
  }

  // 2. Try scoped alias if competition is known
  if (competitionCode) {
    const scopedKey = `${normalized}|${competitionCode}`;
    const scopedId = cache.aliasToClubScoped.get(scopedKey);
    if (scopedId !== undefined) {
      return { clubId: scopedId, mappingType: "alias", displayName: trimmed };
    }
  }

  // 3. Try unscoped alias
  const unscopedEntries = cache.aliasToClubsUnscoped.get(normalized);
  if (unscopedEntries && unscopedEntries.length === 1) {
    return { clubId: unscopedEntries[0].clubId, mappingType: "alias", displayName: unscopedEntries[0].clubName };
  }
  if (unscopedEntries && unscopedEntries.length > 1) {
    return { clubId: null, mappingType: "ambiguous", displayName: trimmed };
  }

  return { clubId: null, mappingType: "unknown", displayName: trimmed };
}

export function findAmbiguousClubsForAlias(
  cache: ValidationCache,
  participantRaw: string,
  competitionCode?: string | null
): AmbiguousClubInfo[] {
  const normalized = normalizeNameForCache(participantRaw);

  if (competitionCode) {
    // Check scoped aliases for ambiguity under this competition
    const scopedKey = `${normalized}|${competitionCode}`;
    const scopedId = cache.aliasToClubScoped.get(scopedKey);
    if (scopedId !== undefined) {
      // Scoped aliases are unique per competition, check if unscoped also exists
      const unscopedEntries = cache.aliasToClubsUnscoped.get(normalized);
      if (unscopedEntries && unscopedEntries.length > 0) {
        const allUnique = new Set([scopedId, ...unscopedEntries.map(e => e.clubId)]);
        if (allUnique.size > 1) {
          // There's ambiguity between scoped and unscoped
          const results: AmbiguousClubInfo[] = [];
          for (const id of allUnique) {
            const club = cache.clubs.find(c => c.id === id);
            if (club) results.push({ name: club.name, clubId: club.id });
          }
          return results;
        }
      }
      return [];
    }
  }

  // Check unscoped aliases
  const unscopedEntries = cache.aliasToClubsUnscoped.get(normalized);
  if (unscopedEntries && unscopedEntries.length > 1) {
    return unscopedEntries.map(e => ({ name: e.clubName, clubId: e.clubId }));
  }

  return [];
}

export function resolveVenue(
  cache: ValidationCache,
  venueRaw: string | null | undefined,
  homeClubId: number | null | undefined
): { venueId: number | null } {
  if (!venueRaw) {
    if (homeClubId !== null && cache.clubToPrimaryVenue.has(homeClubId)) {
      return { venueId: cache.clubToPrimaryVenue.get(homeClubId)! };
    }
    return { venueId: null };
  }

  const normalized = venueRaw.toLowerCase();
  const venueId = cache.venueByName.get(normalized);
  if (venueId !== undefined) {
    return { venueId };
  }

  if (homeClubId !== null && cache.clubToPrimaryVenue.has(homeClubId)) {
    return { venueId: cache.clubToPrimaryVenue.get(homeClubId)! };
  }

  return { venueId: null };
}

function normalizeNameForCache(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
