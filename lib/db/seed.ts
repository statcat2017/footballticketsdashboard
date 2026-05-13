import type { Database as SqliteDatabase } from "better-sqlite3";
import { SEED_DATA } from "./d1.ts";

export function seedDatabase(db: SqliteDatabase): void {
  const seed = db.transaction(() => {
    const insertCompetition = db.prepare(`
      INSERT INTO competitions (code, name, tier)
      VALUES (?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET name = excluded.name, tier = excluded.tier
    `);
    for (const c of SEED_DATA.competitions) {
      insertCompetition.run(c.code, c.name, c.tier);
    }

    const insertVenue = db.prepare(`
      INSERT INTO venues (id, name, postcode, latitude, longitude)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        postcode = excluded.postcode,
        latitude = excluded.latitude,
        longitude = excluded.longitude
    `);
    for (const v of SEED_DATA.venues) {
      insertVenue.run(v.id, v.name, v.postcode, v.latitude, v.longitude);
    }

    const insertClub = db.prepare(`
      INSERT INTO clubs (id, name, football_data_team_id, aliases, short_name, competition_code, venue_id, official_site_url, generic_ticket_url, price_source_url, verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        verified_at = excluded.verified_at
    `);
    for (const cl of SEED_DATA.clubs) {
      insertClub.run(cl.id, cl.name, cl.football_data_team_id, cl.aliases, cl.short_name, cl.competition_code, cl.venue_id, cl.official_site_url, cl.generic_ticket_url, cl.price_source_url, cl.verified_at);
    }

    const insertPrice = db.prepare(`
      INSERT INTO club_ticket_prices (
        club_id, sale_mode, adult_price_pence, concession_price_pence, source_url, verified_at, confidence
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(club_id) DO UPDATE SET
        sale_mode = excluded.sale_mode,
        adult_price_pence = excluded.adult_price_pence,
        concession_price_pence = excluded.concession_price_pence,
        source_url = excluded.source_url,
        verified_at = excluded.verified_at,
        confidence = excluded.confidence
    `);
    for (const p of SEED_DATA.club_ticket_prices) {
      insertPrice.run(p.club_id, p.sale_mode, p.adult_price_pence, p.concession_price_pence, p.source_url, p.verified_at, p.confidence);
    }

    const insertFixture = db.prepare(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source, source_id) DO UPDATE SET
        competition_code = excluded.competition_code,
        home_club_id = excluded.home_club_id,
        away_club_id = excluded.away_club_id,
        venue_id = excluded.venue_id,
        kickoff_at = excluded.kickoff_at,
        status = excluded.status,
        is_demo_data = excluded.is_demo_data,
        is_historical = excluded.is_historical
    `);
    for (const f of SEED_DATA.fixtures) {
      insertFixture.run(f.source, f.source_id, f.competition_code, f.home_club_id, f.away_club_id, f.venue_id, f.kickoff_at, f.status, f.is_demo_data, f.is_historical);
    }

    const insertTravel = db.prepare(`
      INSERT INTO travel_cache (
        postcode_district, venue_id, distance_miles, driving_minutes,
        public_transport_minutes, provider, calculated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(postcode_district, venue_id) DO UPDATE SET
        distance_miles = excluded.distance_miles,
        driving_minutes = excluded.driving_minutes,
        public_transport_minutes = excluded.public_transport_minutes,
        provider = excluded.provider,
        calculated_at = excluded.calculated_at
    `);
    for (const t of SEED_DATA.travel_cache) {
      insertTravel.run(t.postcode_district, t.venue_id, t.distance_miles, t.driving_minutes, t.public_transport_minutes, t.provider, t.calculated_at);
    }
  });

  seed();
}
