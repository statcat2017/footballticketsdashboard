import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const databaseName = process.argv[2];
const token = process.env.FOOTBALL_DATA_API_TOKEN;

if (!databaseName) {
  console.error("Usage: node --experimental-strip-types scripts/import-football-data-d1.ts <d1-database-name>");
  process.exit(1);
}

if (!token) {
  console.error("FOOTBALL_DATA_API_TOKEN is required.");
  process.exit(1);
}

const competitions = ["PL", "ELC"] as const;
const importedAt = new Date().toISOString();
const clubs = fetchClubRows(databaseName);
const clubLookup = buildClubLookup(clubs);

let fetched = 0;
let imported = 0;
let skipped = 0;

const statements: string[] = [];

for (const competition of competitions) {
  const response = await fetch(`https://api.football-data.org/v4/competitions/${competition}/matches`, {
    headers: { "X-Auth-Token": token }
  });

  if (!response.ok) {
    throw new Error(`football-data request failed for ${competition}: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as {
    matches?: Array<{
      id: number;
      utcDate: string | null;
      status: string;
      lastUpdated?: string;
      competition: { code: string };
      homeTeam: { id: number; name: string; shortName?: string; tla?: string };
      awayTeam: { id: number; name: string; shortName?: string; tla?: string };
    }>;
  };

  const matches = body.matches ?? [];
  fetched += matches.length;

  for (const match of matches) {
    if (!competitions.includes(match.competition.code as (typeof competitions)[number])) {
      skipped += 1;
      continue;
    }

    const homeClub = findClub(clubLookup, match.homeTeam);
    const awayClub = findClub(clubLookup, match.awayTeam);

    if (!homeClub || !awayClub) {
      skipped += 1;
      continue;
    }

    statements.push(`
INSERT INTO fixtures (
  source, source_id, competition_code, home_club_id, away_club_id, venue_id,
  kickoff_at, status, is_demo_data, is_historical, source_updated_at, imported_at
)
VALUES (
  'football-data',
  '${match.id}',
  '${escapeSql(match.competition.code)}',
  ${homeClub.id},
  ${awayClub.id},
  ${homeClub.venue_id},
  ${match.utcDate ? `'${escapeSql(match.utcDate)}'` : "NULL"},
  '${normalizeStatus(match.status)}',
  0,
  0,
  ${match.lastUpdated ? `'${escapeSql(match.lastUpdated)}'` : "NULL"},
  '${importedAt}'
)
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
  imported_at = excluded.imported_at;
`);
    imported += 1;
  }
}

if (statements.length > 0) {
  const dirname = fs.mkdtempSync(path.join(os.tmpdir(), "football-d1-import-"));
  const filename = path.join(dirname, "fixtures.sql");
  fs.writeFileSync(filename, statements.join("\n"), "utf8");
  execFileSync("npx", ["wrangler", "d1", "execute", databaseName, "--remote", "--file", filename], {
    stdio: "inherit"
  });
}

console.log(`football-data import complete: fetched ${fetched}, imported ${imported}, skipped ${skipped}`);

interface ClubRow {
  id: number;
  name: string;
  football_data_team_id: number | null;
  aliases: string | null;
  short_name: string | null;
  venue_id: number;
}

function fetchClubRows(databaseNameValue: string): ClubRow[] {
  return queryRows<ClubRow>(
    databaseNameValue,
    "SELECT id, name, football_data_team_id, aliases, short_name, venue_id FROM clubs"
  );
}

function queryRows<T>(databaseNameValue: string, sql: string): T[] {
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", databaseNameValue, "--remote", "--json", "--command", sql],
    { encoding: "utf8" }
  );
  const parsed = JSON.parse(output) as Array<{ results?: T[] }>;
  return parsed[0]?.results ?? [];
}

function buildClubLookup(clubs: ClubRow[]): Map<string, ClubRow> {
  const lookup = new Map<string, ClubRow>();

  for (const club of clubs) {
    if (club.football_data_team_id !== null) {
      lookup.set(teamIdKey(club.football_data_team_id), club);
    }

    const aliases = club.aliases?.split("|") ?? [];

    for (const key of clubKeys(club.name, club.short_name ?? undefined, ...aliases)) {
      lookup.set(key, club);
    }
  }

  return lookup;
}

function findClub(
  clubLookup: Map<string, ClubRow>,
  team: { id: number; name: string; shortName?: string; tla?: string }
): ClubRow | undefined {
  const byId = clubLookup.get(teamIdKey(team.id));

  if (byId) {
    return byId;
  }

  for (const key of clubKeys(team.name, team.shortName, team.tla)) {
    const club = clubLookup.get(key);

    if (club) {
      return club;
    }
  }

  return undefined;
}

function teamIdKey(id: number): string {
  return `football-data:${id}`;
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

function escapeSql(value: string): string {
  return value.replaceAll("'", "''");
}
