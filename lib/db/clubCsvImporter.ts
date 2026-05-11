import fs from "node:fs";
import type { Database as SqliteDatabase } from "better-sqlite3";
import type { AppDatabase } from "@/lib/db/adapter";

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

export function importClubCsv(db: SqliteDatabase, filename = "data/clubs.csv"): ImportClubCsvResult {
  const content = fs.readFileSync(filename, "utf8");
  const rows = parseClubCsv(content);
  const importRows = db.transaction(() => {
    let imported = 0;

    for (const row of rows) {
      upsertClubRow(db, row);
      imported += 1;
    }

    return imported;
  });

  return {
    rows: rows.length,
    imported: importRows()
  };
}

export async function importClubCsvIntoDatabase(db: AppDatabase, filename = "data/clubs.csv"): Promise<ImportClubCsvResult> {
  const content = fs.readFileSync(filename, "utf8");
  const rows = parseClubCsv(content);

  for (const row of rows) {
    await upsertClubRowAsync(db, row);
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

function upsertClubRow(db: SqliteDatabase, row: ClubCsvRow): void {
  const venueId = stableVenueId(row.competition, row.club_name);
  const clubId = existingClubId(db, row) ?? stableClubId(row.competition, row.club_name);

  db.prepare(`
    INSERT INTO competitions (code, name, tier)
    VALUES (@code, @name, @tier)
    ON CONFLICT(code) DO UPDATE SET name = excluded.name, tier = excluded.tier
  `).run({
    code: row.competition,
    name: competitionName(row.competition),
    tier: competitionTier(row.competition)
  });

  db.prepare(`
    INSERT INTO venues (id, name, postcode, latitude, longitude)
    VALUES (@id, @name, @postcode, @latitude, @longitude)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      postcode = excluded.postcode,
      latitude = excluded.latitude,
      longitude = excluded.longitude
  `).run({
    id: venueId,
    name: row.ground_name,
    postcode: row.postcode,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude)
  });

  db.prepare(`
    INSERT INTO clubs (
      id, name, football_data_team_id, aliases, short_name, competition_code, venue_id,
      official_site_url, generic_ticket_url, price_source_url, ground_source_url,
      coordinates_source_url, verified_at
    )
    VALUES (
      @id, @name, @footballDataTeamId, @aliases, @shortName, @competitionCode, @venueId,
      @officialSiteUrl, @genericTicketUrl, @priceSourceUrl, @groundSourceUrl,
      @coordinatesSourceUrl, @verifiedAt
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
      verified_at = excluded.verified_at
  `).run({
    id: clubId,
    name: row.club_name,
    footballDataTeamId: row.football_data_team_id ? Number(row.football_data_team_id) : null,
    aliases: row.aliases,
    shortName: row.club_name,
    competitionCode: row.competition,
    venueId,
    officialSiteUrl: row.official_site_url,
    genericTicketUrl: row.ticket_url,
    priceSourceUrl: row.price_source_url,
    groundSourceUrl: row.ground_source_url,
    coordinatesSourceUrl: row.coordinates_source_url,
    verifiedAt: row.verified_at
  });

  db.prepare(`
    INSERT INTO club_ticket_prices (
      club_id, sale_mode, adult_price_pence, concession_price_pence, source_url, verified_at, confidence
    )
    VALUES (@clubId, NULL, NULL, NULL, @sourceUrl, @verifiedAt, 'unknown')
    ON CONFLICT(club_id) DO UPDATE SET
      source_url = excluded.source_url,
      verified_at = excluded.verified_at
  `).run({
    clubId,
    sourceUrl: row.price_source_url,
    verifiedAt: row.verified_at
  });
}

async function upsertClubRowAsync(db: AppDatabase, row: ClubCsvRow): Promise<void> {
  const venueId = stableVenueId(row.competition, row.club_name);
  const clubId = (await existingClubIdAsync(db, row)) ?? stableClubId(row.competition, row.club_name);

  await db.run(`
    INSERT INTO competitions (code, name, tier)
    VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET name = excluded.name, tier = excluded.tier
  `, [row.competition, competitionName(row.competition), competitionTier(row.competition)]);

  await db.run(`
    INSERT INTO venues (id, name, postcode, latitude, longitude)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      postcode = excluded.postcode,
      latitude = excluded.latitude,
      longitude = excluded.longitude
  `, [
    venueId,
    row.ground_name,
    row.postcode,
    Number(row.latitude),
    Number(row.longitude)
  ]);

  await db.run(`
    INSERT INTO clubs (
      id, name, football_data_team_id, aliases, short_name, competition_code, venue_id,
      official_site_url, generic_ticket_url, price_source_url, ground_source_url,
      coordinates_source_url, verified_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      verified_at = excluded.verified_at
  `, [
    clubId,
    row.club_name,
    row.football_data_team_id ? Number(row.football_data_team_id) : null,
    row.aliases,
    row.club_name,
    row.competition,
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

function existingClubId(db: SqliteDatabase, row: ClubCsvRow): number | null {
  if (row.football_data_team_id) {
    const byTeamId = db.prepare("SELECT id FROM clubs WHERE football_data_team_id = ?").get(Number(row.football_data_team_id)) as
      | { id: number }
      | undefined;

    if (byTeamId) {
      return byTeamId.id;
    }
  }

  const byName = db.prepare("SELECT id FROM clubs WHERE name = ?").get(row.club_name) as { id: number } | undefined;
  return byName?.id ?? null;
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

function competitionName(code: string): string {
  if (code === "PL") {
    return "Premier League";
  }

  if (code === "ELC") {
    return "Championship";
  }

  return code;
}

function competitionTier(code: string): number {
  if (code === "PL") {
    return 1;
  }

  if (code === "ELC") {
    return 2;
  }

  return 2;
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

function stableId(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return 10_000 + (hash % 1_000_000);
}
