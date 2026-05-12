import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { parseClubCsv, stableId } from "../lib/db/clubCsvImporter.ts";
import { competitionName, competitionTier } from "../lib/db/competition.ts";
import { escapeSql } from "../lib/db/sql.ts";

const databaseName = process.argv[2];
const csvPath = process.argv[3] ?? "data/clubs.csv";

if (!databaseName) {
  console.error("Usage: node --experimental-strip-types scripts/import-clubs-d1.ts <d1-database-name> [csv-path]");
  process.exit(1);
}

const content = readFileSync(csvPath, "utf8");
const rows = parseClubCsv(content);

for (const row of rows) {
  const venueId = stableId(`${row.competition}:venue:${row.club_name}`);
  const clubId = findExistingClubId(databaseName, row) ?? stableId(`${row.competition}:club:${row.club_name}`);

  execute(databaseName, `
INSERT INTO competitions (code, name, tier)
VALUES ('${escapeSql(row.competition)}', '${escapeSql(competitionName(row.competition))}', ${competitionTier(row.competition)})
ON CONFLICT(code) DO UPDATE SET name = excluded.name, tier = excluded.tier;

INSERT INTO venues (id, name, postcode, latitude, longitude)
VALUES (${venueId}, '${escapeSql(row.ground_name)}', '${escapeSql(row.postcode)}', ${Number(row.latitude)}, ${Number(row.longitude)})
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  postcode = excluded.postcode,
  latitude = excluded.latitude,
  longitude = excluded.longitude;

INSERT INTO clubs (
  id, name, football_data_team_id, aliases, short_name, competition_code, venue_id,
  official_site_url, generic_ticket_url, price_source_url, ground_source_url,
  coordinates_source_url, verified_at
)
VALUES (
  ${clubId},
  '${escapeSql(row.club_name)}',
  ${row.football_data_team_id ? Number(row.football_data_team_id) : "NULL"},
  ${row.aliases ? `'${escapeSql(row.aliases)}'` : "NULL"},
  '${escapeSql(row.club_name)}',
  '${escapeSql(row.competition)}',
  ${venueId},
  '${escapeSql(row.official_site_url)}',
  '${escapeSql(row.ticket_url)}',
  ${row.price_source_url ? `'${escapeSql(row.price_source_url)}'` : "NULL"},
  ${row.ground_source_url ? `'${escapeSql(row.ground_source_url)}'` : "NULL"},
  ${row.coordinates_source_url ? `'${escapeSql(row.coordinates_source_url)}'` : "NULL"},
  '${escapeSql(row.verified_at)}'
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  football_data_team_id = excluded.football_data_team_id,
  aliases = excluded.aliases,
  short_name = excluded.short_name,
  competition_code = excluded.competition_code,
  venue_id = excluded.venue_id,
  official_site_url = excluded.official_site_url,
  generic_ticket_url = excluded.generic_ticket_url,
  price_source_url = excluded.price_source_url,
  ground_source_url = excluded.ground_source_url,
  coordinates_source_url = excluded.coordinates_source_url,
  verified_at = excluded.verified_at;

INSERT INTO club_ticket_prices (club_id, sale_mode, adult_price_pence, concession_price_pence, source_url, verified_at, confidence)
VALUES (${clubId}, NULL, NULL, NULL, ${row.price_source_url ? `'${escapeSql(row.price_source_url)}'` : "NULL"}, '${escapeSql(row.verified_at)}', 'unknown')
ON CONFLICT(club_id) DO UPDATE SET
  source_url = excluded.source_url,
  verified_at = excluded.verified_at;
`);
}

console.log(`club import complete: imported ${rows.length} of ${rows.length} rows from ${csvPath} into ${databaseName}`);

function findExistingClubId(
  databaseNameValue: string,
  row: ReturnType<typeof parseClubCsv>[number]
): number | null {
  if (row.football_data_team_id) {
    const byTeamId = querySingleNumber(
      databaseNameValue,
      `SELECT id FROM clubs WHERE football_data_team_id = ${Number(row.football_data_team_id)} LIMIT 1`
    );

    if (byTeamId !== null) {
      return byTeamId;
    }
  }

  return querySingleNumber(
    databaseNameValue,
    `SELECT id FROM clubs WHERE name = '${escapeSql(row.club_name)}' LIMIT 1`
  );
}

function execute(name: string, sql: string) {
  execFileSync("npx", ["wrangler", "d1", "execute", name, "--remote", "--command", sql], {
    stdio: "inherit"
  });
}

function querySingleNumber(databaseNameValue: string, sql: string): number | null {
  const output = execFileSync("npx", ["wrangler", "d1", "execute", databaseNameValue, "--remote", "--json", "--command", sql], {
    encoding: "utf8"
  });
  const parsed = JSON.parse(output) as Array<{ results?: Array<Record<string, number>> }>;
  const row = parsed[0]?.results?.[0];

  if (!row) {
    return null;
  }

  const value = Object.values(row)[0];
  return typeof value === "number" ? value : null;
}


