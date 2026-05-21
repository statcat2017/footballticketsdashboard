import fs from "node:fs";
import type { Database as SqliteDatabase } from "better-sqlite3";
import { createSqliteAppDatabase, type AppDatabase } from "./adapter.ts";
import { competitionName, competitionTier } from "./competition.ts";

const expectedHeader = [
  "competition",
  "club_name",
  "football_data_team_id",
  "aliases",
  "ground_name",
  "postcode",
  "latitude",
  "longitude",
  "official_site_url",
  "ticket_url",
  "price_source_url",
  "ground_source_url",
  "coordinates_source_url",
  "verified_at"
] as const;

type ClubCsvHeader = (typeof expectedHeader)[number];

type ClubCsvRow = Record<ClubCsvHeader, string>;

export interface ImportClubCsvResult {
  rows: number;
  imported: number;
}

export async function importClubCsv(db: SqliteDatabase | AppDatabase, filename = "data/clubs.csv"): Promise<ImportClubCsvResult> {
  const appDb = toAppDatabase(db);
  const content = fs.readFileSync(filename, "utf8");
  const rows = parseClubCsv(content);

  for (const row of rows) {
    await upsertClubRowAsync(appDb, row);
  }

  return {
    rows: rows.length,
    imported: rows.length
  };
}

export function parseClubCsv(content: string): ClubCsvRow[] {
  const lines = content.trim().split(/\r?\n/);
  const [headerLine, ...dataLines] = lines;

  if (!headerLine) {
    throw new Error("Club CSV is empty.");
  }

  const header = parseCsvLine(headerLine);

  if (header.join(",") !== expectedHeader.join(",")) {
    throw new Error(`Club CSV header must be: ${expectedHeader.join(",")}`);
  }

  return dataLines.map((line, index) => {
    const values = parseCsvLine(line);

    if (values.length !== expectedHeader.length) {
      throw new Error(`Club CSV row ${index + 2} has ${values.length} fields; expected ${expectedHeader.length}.`);
    }

    const row = Object.fromEntries(expectedHeader.map((key, keyIndex) => [key, values[keyIndex].trim()])) as ClubCsvRow;
    validateRow(row, index + 2);
    return row;
  });
}

async function upsertClubRowAsync(db: AppDatabase, row: ClubCsvRow): Promise<void> {
  const venueId = stableVenueId(row.competition, row.club_name);
  const clubId = (await existingClubIdAsync(db, row)) ?? stableClubId(row.competition, row.club_name);

  await db.run(`
    INSERT INTO competitions (code, name, tier, kind)
    VALUES (?, ?, ?, 'league')
    ON CONFLICT(code) DO UPDATE SET name = excluded.name, tier = excluded.tier
  `, [row.competition, competitionName(row.competition), competitionTier(row.competition)]);

  await db.run(`
    INSERT INTO venues (id, name, postcode, latitude, longitude, is_approximate)
    VALUES (?, ?, ?, ?, ?, 0)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      postcode = excluded.postcode,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      is_approximate = excluded.is_approximate
  `, [
    venueId,
    row.ground_name,
    row.postcode,
    Number(row.latitude),
    Number(row.longitude)
  ]);

  await db.run(`
    INSERT INTO clubs (
      id, name, football_data_team_id, aliases, venue_id,
      official_site_url, generic_ticket_url, price_source_url, ground_source_url,
      coordinates_source_url, verified_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      football_data_team_id = excluded.football_data_team_id,
      aliases = excluded.aliases,
      venue_id = excluded.venue_id,
      official_site_url = excluded.official_site_url,
      generic_ticket_url = excluded.generic_ticket_url,
      price_source_url = excluded.price_source_url,
      ground_source_url = excluded.ground_source_url,
      coordinates_source_url = excluded.coordinates_source_url,
      verified_at = excluded.verified_at
  `, [
    clubId,
    row.club_name,
    row.football_data_team_id ? Number(row.football_data_team_id) : null,
    row.aliases,
    venueId,
    row.official_site_url,
    row.ticket_url,
    row.price_source_url,
    row.ground_source_url,
    row.coordinates_source_url,
    row.verified_at
  ]);

  await db.run(`
    INSERT INTO club_ticket_prices (
      club_id, sale_mode, adult_price_pence, concession_price_pence, source_url, verified_at, confidence
    )
    VALUES (?, NULL, NULL, NULL, ?, ?, 'unknown')
    ON CONFLICT(club_id) DO UPDATE SET
      source_url = excluded.source_url,
      verified_at = excluded.verified_at
  `, [clubId, row.price_source_url, row.verified_at]);
}

async function existingClubIdAsync(db: AppDatabase, row: ClubCsvRow): Promise<number | null> {
  if (row.football_data_team_id) {
    const byTeamId = await db.get<{ id: number }>(
      "SELECT id FROM clubs WHERE football_data_team_id = ?",
      [Number(row.football_data_team_id)]
    );

    if (byTeamId) {
      return byTeamId.id;
    }
  }

  const byName = await db.get<{ id: number }>("SELECT id FROM clubs WHERE name = ?", [row.club_name]);
  return byName?.id ?? null;
}

function validateRow(row: ClubCsvRow, rowNumber: number): void {
  for (const field of ["competition", "club_name", "ground_name", "postcode", "latitude", "longitude", "official_site_url", "ticket_url", "verified_at"] as const) {
    if (!row[field]) {
      throw new Error(`Club CSV row ${rowNumber} is missing ${field}.`);
    }
  }

  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error(`Club CSV row ${rowNumber} has invalid latitude.`);
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`Club CSV row ${rowNumber} has invalid longitude.`);
  }

  for (const field of ["official_site_url", "ticket_url", "price_source_url", "ground_source_url", "coordinates_source_url"] as const) {
    if (row[field]) {
      try {
        new URL(row[field]);
      } catch {
        throw new Error(`Club CSV row ${rowNumber} has invalid ${field}.`);
      }
    }
  }
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function stableClubId(competition: string, clubName: string): number {
  return stableId(`${competition}:club:${clubName}`);
}

function stableVenueId(competition: string, clubName: string): number {
  return stableId(`${competition}:venue:${clubName}`);
}

export function stableId(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) + 1000;
}

function toAppDatabase(db: SqliteDatabase | AppDatabase): AppDatabase {
  if (typeof (db as SqliteDatabase).prepare === "function") {
    return createSqliteAppDatabase(db as SqliteDatabase);
  }
  return db as AppDatabase;
}
