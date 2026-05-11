import type { Database as SqliteDatabase } from "better-sqlite3";
import type { AppDatabase } from "./adapter.ts";
import { buildClubLookup, findClub, normalizeStatus, type ClubRow, type FootballDataTeam } from "./clubLookup.ts";

const footballDataBaseUrl = "https://api.football-data.org/v4";
const competitions = ["PL", "ELC"] as const;

type CompetitionCode = (typeof competitions)[number];

type FetchLike = (input: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}>;

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

export interface ImportFootballDataOptions {
  db: SqliteDatabase | AppDatabase;
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

  const clubLookup = await buildClubLookupFromDb(db);
  const importedAt = now.toISOString();
  let fetched = 0;
  let imported = 0;
  let skipped = 0;

  for (const competitionCode of competitions) {
    const response = await fetchCompetitionMatches(fetchImpl, token, competitionCode);
    fetched += response.matches.length;

    const result = await upsertMatches(db, response.matches, clubLookup, importedAt);
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

async function buildClubLookupFromDb(db: SqliteDatabase | AppDatabase): Promise<Map<string, ClubRow>> {
  const clubs = isAppDatabase(db)
    ? await db.all<ClubRow>(`
        SELECT id, name, football_data_team_id, aliases, short_name, venue_id
        FROM clubs
      `)
    : (db.prepare(`
        SELECT id, name, football_data_team_id, aliases, short_name, venue_id
        FROM clubs
      `).all() as ClubRow[]);

  return buildClubLookup(clubs);
}

async function upsertMatches(
  db: SqliteDatabase | AppDatabase,
  matches: FootballDataMatch[],
  clubLookup: Map<string, ClubRow>,
  importedAt: string
): Promise<{ imported: number; skipped: number }> {
  if (isAppDatabase(db)) {
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

      await db.run(`
        INSERT INTO fixtures (
          source, source_id, competition_code, home_club_id, away_club_id, venue_id,
          kickoff_at, status, is_demo_data, is_historical, source_updated_at, imported_at
        )
        VALUES ('football-data', ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
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
      `, [
        String(match.id),
        competitionCode,
        homeClub.id,
        awayClub.id,
        homeClub.venue_id,
        match.utcDate,
        normalizeStatus(match.status),
        match.lastUpdated ?? null,
        importedAt
      ]);
      imported += 1;
    }

    return { imported, skipped };
  }

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

function isAppDatabase(db: SqliteDatabase | AppDatabase): db is AppDatabase {
  return "all" in db && "get" in db && "run" in db && "exec" in db;
}

function isCompetitionCode(value: string): value is CompetitionCode {
  return competitions.includes(value as CompetitionCode);
}

function isFootballDataResponse(value: unknown): value is FootballDataResponse {
  return Boolean(value && typeof value === "object" && Array.isArray((value as { matches?: unknown }).matches));
}
