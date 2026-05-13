import { SEED_DATA } from "../seed/data.ts";
import type { AppDatabase, QueryParam } from "./adapter.ts";
import { createSqliteAppDatabase } from "./adapter.ts";
import { clubs, venues, fixtures, club_ticket_prices, travel_cache } from "./schema.ts";
import type { DB } from "./schema.ts";

let db: AppDatabase | null = null;

export function getAppDatabase(databaseFile?: string): AppDatabase {
  if (db && !databaseFile) return db;
  const Database = require("better-sqlite3");
  const sqliteDb = new Database(databaseFile ?? ":memory:");
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.pragma("foreign_keys = ON");
  db = createSqliteAppDatabase(sqliteDb);
  return db;
}

export function initDatabase(databaseFile?: string): AppDatabase {
  const database = getAppDatabase(databaseFile);
  database.exec(`
    CREATE TABLE IF NOT EXISTS competitions (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tier INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS venues (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      postcode TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clubs (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      football_data_team_id INTEGER,
      aliases TEXT NOT NULL,
      short_name TEXT NOT NULL,
      competition_code TEXT NOT NULL REFERENCES competitions(code),
      venue_id INTEGER NOT NULL REFERENCES venues(id),
      official_site_url TEXT NOT NULL DEFAULT '',
      generic_ticket_url TEXT NOT NULL DEFAULT '',
      price_source_url TEXT NOT NULL DEFAULT '',
      verified_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS club_ticket_prices (
      club_id INTEGER PRIMARY KEY REFERENCES clubs(id),
      sale_mode TEXT NOT NULL DEFAULT 'unknown',
      adult_price_pence INTEGER,
      concession_price_pence INTEGER,
      source_url TEXT NOT NULL DEFAULT '',
      verified_at TEXT NOT NULL DEFAULT '',
      confidence TEXT NOT NULL DEFAULT 'low'
    );
    CREATE TABLE IF NOT EXISTS fixtures (
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      competition_code TEXT NOT NULL REFERENCES competitions(code),
      home_club_id INTEGER NOT NULL REFERENCES clubs(id),
      away_club_id INTEGER NOT NULL REFERENCES clubs(id),
      venue_id INTEGER NOT NULL REFERENCES venues(id),
      kickoff_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      is_demo_data INTEGER NOT NULL DEFAULT 0,
      is_historical INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (source, source_id)
    );
    CREATE TABLE IF NOT EXISTS travel_cache (
      postcode_district TEXT NOT NULL,
      venue_id INTEGER NOT NULL REFERENCES venues(id),
      distance_miles REAL NOT NULL,
      driving_minutes REAL,
      public_transport_minutes REAL,
      provider TEXT,
      calculated_at TEXT NOT NULL,
      PRIMARY KEY (postcode_district, venue_id)
    );
    CREATE TABLE IF NOT EXISTS corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_source TEXT NOT NULL,
      fixture_source_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      suggested_value TEXT NOT NULL,
      reason TEXT,
      submitter_email TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      reviewer_notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fixtures_kickoff ON fixtures(kickoff_at);
    CREATE INDEX IF NOT EXISTS idx_fixtures_competition ON fixtures(competition_code);
    CREATE INDEX IF NOT EXISTS idx_fixtures_home ON fixtures(home_club_id);
    CREATE INDEX IF NOT EXISTS idx_fixtures_away ON fixtures(away_club_id);
    CREATE INDEX IF NOT EXISTS idx_fixtures_venue ON fixtures(venue_id);
    CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status);
    CREATE INDEX IF NOT EXISTS idx_clubs_competition ON clubs(competition_code);
    CREATE INDEX IF NOT EXISTS idx_clubs_venue ON clubs(venue_id);
    CREATE INDEX IF NOT EXISTS idx_travel_cache_venue ON travel_cache(venue_id);
    CREATE INDEX IF NOT EXISTS idx_travel_cache_postcode ON travel_cache(postcode_district);
  `);
  return database;
}

export function seedDatabase(database: AppDatabase): void {
  const insertCompetition = database.prepare(`
    INSERT INTO competitions (code, name, tier)
    VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET name = excluded.name, tier = excluded.tier
  `);
  for (const c of SEED_DATA.competitions) {
    insertCompetition.run(c.code, c.name, c.tier);
  }

  const insertVenue = database.prepare(`
    INSERT INTO venues (id, name, postcode, latitude, longitude)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, postcode = excluded.postcode, latitude = excluded.latitude, longitude = excluded.longitude
  `);
  for (const v of SEED_DATA.venues) {
    insertVenue.run(v.id, v.name, v.postcode, v.latitude, v.longitude);
  }

  const insertClub = database.prepare(`
    INSERT INTO clubs (id, name, football_data_team_id, aliases, short_name, competition_code, venue_id, official_site_url, generic_ticket_url, price_source_url, verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, football_data_team_id = excluded.football_data_team_id, aliases = excluded.aliases, short_name = excluded.short_name, competition_code = excluded.competition_code, venue_id = excluded.venue_id, official_site_url = excluded.official_site_url, generic_ticket_url = excluded.generic_ticket_url, price_source_url = excluded.price_source_url, verified_at = excluded.verified_at
  `);
  for (const cl of SEED_DATA.clubs) {
    insertClub.run(cl.id, cl.name, cl.football_data_team_id, cl.aliases, cl.short_name, cl.competition_code, cl.venue_id, cl.official_site_url, cl.generic_ticket_url, cl.price_source_url, cl.verified_at);
  }

  const insertTicketPrice = database.prepare(`
    INSERT INTO club_ticket_prices (club_id, sale_mode, adult_price_pence, concession_price_pence, source_url, verified_at, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(club_id) DO UPDATE SET sale_mode = excluded.sale_mode, adult_price_pence = excluded.adult_price_pence, concession_price_pence = excluded.concession_price_pence, source_url = excluded.source_url, verified_at = excluded.verified_at, confidence = excluded.confidence
  `);
  for (const p of SEED_DATA.club_ticket_prices) {
    insertTicketPrice.run(p.club_id, p.sale_mode, p.adult_price_pence, p.concession_price_pence, p.source_url, p.verified_at, p.confidence);
  }

  const insertFixture = database.prepare(`
    INSERT INTO fixtures (source, source_id, competition_code, home_club_id, away_club_id, venue_id, kickoff_at, status, is_demo_data, is_historical)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source, source_id) DO UPDATE SET competition_code = excluded.competition_code, home_club_id = excluded.home_club_id, away_club_id = excluded.away_club_id, venue_id = excluded.venue_id, kickoff_at = excluded.kickoff_at, status = excluded.status, is_demo_data = excluded.is_demo_data, is_historical = excluded.is_historical
  `);
  for (const f of SEED_DATA.fixtures) {
    insertFixture.run(f.source, f.source_id, f.competition_code, f.home_club_id, f.away_club_id, f.venue_id, f.kickoff_at, f.status, f.is_demo_data, f.is_historical);
  }

  const insertTravelCache = database.prepare(`
    INSERT INTO travel_cache (postcode_district, venue_id, distance_miles, driving_minutes, public_transport_minutes, provider, calculated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(postcode_district, venue_id) DO UPDATE SET distance_miles = excluded.distance_miles, driving_minutes = excluded.driving_minutes, public_transport_minutes = excluded.public_transport_minutes, provider = excluded.provider, calculated_at = excluded.calculated_at
  `);
  for (const t of SEED_DATA.travel_cache) {
    insertTravelCache.run(
      t.postcode_district, t.venue_id, t.distance_miles, t.driving_minutes, t.public_transport_minutes, t.provider, t.calculated_at
    );
  }
}
