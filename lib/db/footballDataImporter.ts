import type { Database as SqliteDatabase } from "better-sqlite3";

const footballDataBaseUrl = "https://api.football-data.org/v4";
const competitions = ["PL", "ELC"] as const;

type CompetitionCode = (typeof competitions)[number];

type FetchLike = (input: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}>;

interface FootballDataTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
}

interface FootballDataMatch {
  id: number;
  utcDate: string | null;
  status: string;
  lastUpdated?: string;
  competition: {
    code: string;
  };
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
}

interface FootballDataResponse {
  matches: FootballDataMatch[];
}

interface ClubRow {
  id: number;
  name: string;
  short_name: string | null;
  competition_code: string;
  venue_id: number;
}

export interface ImportFootballDataOptions {
  db: SqliteDatabase;
  token?: string;
  fetchImpl?: FetchLike;
  now?: Date;
}

export interface ImportFootballDataResult {
  fetched: number;
  imported: number;
  skipped: number;
  competitions: CompetitionCode[];
}

export async function importFootballDataFixtures({
  db,
  token = process.env.FOOTBALL_DATA_API_TOKEN,
  fetchImpl = globalThis.fetch as FetchLike,
  now = new Date()
}: ImportFootballDataOptions): Promise<ImportFootballDataResult> {
  if (!token) {
    throw new Error("FOOTBALL_DATA_API_TOKEN is required to import football-data fixtures.");
  }

  if (!fetchImpl) {
    throw new Error("A fetch implementation is required to import football-data fixtures.");
  }

  const clubLookup = buildClubLookup(db);
  const importedAt = now.toISOString();
  let fetched = 0;
  let imported = 0;
  let skipped = 0;

  for (const competitionCode of competitions) {
    const response = await fetchCompetitionMatches(fetchImpl, token, competitionCode);
    fetched += response.matches.length;

    const result = upsertMatches(db, response.matches, clubLookup, importedAt);
    imported += result.imported;
    skipped += result.skipped;
  }

  return {
    fetched,
    imported,
    skipped,
    competitions: [...competitions]
  };
}

async function fetchCompetitionMatches(
  fetchImpl: FetchLike,
  token: string,
  competitionCode: CompetitionCode
): Promise<FootballDataResponse> {
  const url = `${footballDataBaseUrl}/competitions/${competitionCode}/matches`;
  const response = await fetchImpl(url, {
    headers: {
      "X-Auth-Token": token
    }
  });

  if (!response.ok) {
    throw new Error(`football-data request failed for ${competitionCode}: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();

  if (!isFootballDataResponse(body)) {
    throw new Error(`football-data response for ${competitionCode} did not include a matches array.`);
  }

  return body;
}

function buildClubLookup(db: SqliteDatabase): Map<string, ClubRow> {
  const clubs = db.prepare(`
    SELECT id, name, short_name, competition_code, venue_id
    FROM clubs
  `).all() as ClubRow[];
  const lookup = new Map<string, ClubRow>();

  for (const club of clubs) {
    for (const key of clubKeys(club.name, club.short_name ?? undefined)) {
      lookup.set(key, club);
    }
  }

  return lookup;
}

function upsertMatches(
  db: SqliteDatabase,
  matches: FootballDataMatch[],
  clubLookup: Map<string, ClubRow>,
  importedAt: string
): { imported: number; skipped: number } {
  const upsertFixture = db.prepare(`
    INSERT INTO fixtures (
      source, source_id, competition_code, home_club_id, away_club_id, venue_id,
      kickoff_at, status, is_demo_data, is_historical, source_updated_at, imported_at
    )
    VALUES ('football-data', @sourceId, @competitionCode, @homeClubId, @awayClubId, @venueId,
      @kickoffAt, @status, 0, 0, @sourceUpdatedAt, @importedAt)
    ON CONFLICT(source, source_id) DO UPDATE SET
      competition_code = excluded.competition_code,
      home_club_id = excluded.home_club_id,
      away_club_id = excluded.away_club_id,
      venue_id = excluded.venue_id,
      kickoff_at = excluded.kickoff_at,
      status = excluded.status,
      is_demo_data = excluded.is_demo_data,
      is_historical = excluded.is_historical,
      source_updated_at = excluded.source_updated_at,
      imported_at = excluded.imported_at
  `);

  const importTransaction = db.transaction(() => {
    let imported = 0;
    let skipped = 0;

    for (const match of matches) {
      const competitionCode = match.competition.code;

      if (!isCompetitionCode(competitionCode)) {
        skipped += 1;
        continue;
      }

      const homeClub = findClub(clubLookup, match.homeTeam);
      const awayClub = findClub(clubLookup, match.awayTeam);

      if (!homeClub || !awayClub) {
        skipped += 1;
        continue;
      }

      upsertFixture.run({
        sourceId: String(match.id),
        competitionCode,
        homeClubId: homeClub.id,
        awayClubId: awayClub.id,
        venueId: homeClub.venue_id,
        kickoffAt: match.utcDate,
        status: normalizeStatus(match.status),
        sourceUpdatedAt: match.lastUpdated ?? null,
        importedAt
      });
      imported += 1;
    }

    return { imported, skipped };
  });

  return importTransaction();
}

function findClub(clubLookup: Map<string, ClubRow>, team: FootballDataTeam): ClubRow | undefined {
  for (const key of clubKeys(team.name, team.shortName, team.tla)) {
    const club = clubLookup.get(key);

    if (club) {
      return club;
    }
  }

  return undefined;
}

function clubKeys(...values: Array<string | undefined>): string[] {
  return values
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => {
      const normalized = normalizeClubName(value);
      const withoutSuffix = normalized.replace(/\b(afc|fc|football club)\b/g, "").replace(/\s+/g, " ").trim();
      return [normalized, withoutSuffix];
    });
}

function normalizeClubName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStatus(status: string): "scheduled" | "postponed" | "cancelled" | "finished" | "unknown" {
  switch (status) {
    case "SCHEDULED":
    case "TIMED":
    case "IN_PLAY":
    case "PAUSED":
      return "scheduled";
    case "POSTPONED":
    case "SUSPENDED":
      return "postponed";
    case "CANCELLED":
      return "cancelled";
    case "FINISHED":
    case "AWARDED":
      return "finished";
    default:
      return "unknown";
  }
}

function isCompetitionCode(value: string): value is CompetitionCode {
  return competitions.includes(value as CompetitionCode);
}

function isFootballDataResponse(value: unknown): value is FootballDataResponse {
  return Boolean(value && typeof value === "object" && Array.isArray((value as { matches?: unknown }).matches));
}
