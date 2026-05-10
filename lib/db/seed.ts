import type { Database as SqliteDatabase } from "better-sqlite3";

const now = "2026-05-10T00:00:00.000Z";

export function seedDatabase(db: SqliteDatabase): void {
  const seed = db.transaction(() => {
    const insertCompetition = db.prepare(`
      INSERT INTO competitions (code, name, tier)
      VALUES (?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET name = excluded.name, tier = excluded.tier
    `);
    insertCompetition.run("PL", "Premier League", 1);
    insertCompetition.run("ELC", "Championship", 2);

    const insertVenue = db.prepare(`
      INSERT INTO venues (id, name, postcode, latitude, longitude)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        postcode = excluded.postcode,
        latitude = excluded.latitude,
        longitude = excluded.longitude
    `);
    insertVenue.run(1, "Stamford Bridge", "SW6 1HS", 51.4817, -0.191);
    insertVenue.run(2, "Loftus Road", "W12 7PJ", 51.509, -0.2321);
    insertVenue.run(3, "Emirates Stadium", "N5 1BU", 51.5549, -0.1084);
    insertVenue.run(4, "Old Trafford", "M16 0RA", 53.4631, -2.2913);
    insertVenue.run(5, "Carrow Road", "NR1 1JE", 52.6221, 1.3091);
    insertVenue.run(6, "St Andrew's", "B9 4RL", 52.4756, -1.8682);

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
    insertClub.run(1, "Chelsea", 61, "Chelsea FC|Chelsea", "Chelsea", "PL", 1, "https://www.chelseafc.com/", "https://www.chelseafc.com/en/tickets", "https://www.chelseafc.com/en/tickets", "2026-05-10");
    insertClub.run(2, "Arsenal", 57, "Arsenal FC|Arsenal", "Arsenal", "PL", 3, "https://www.arsenal.com/", "https://www.arsenal.com/tickets", "https://www.arsenal.com/tickets", "2026-05-10");
    insertClub.run(3, "Manchester United", 66, "Manchester United FC|Manchester United|Man United|Man Utd", "Man Utd", "PL", 4, "https://www.manutd.com/", "https://tickets.manutd.com/", "https://tickets.manutd.com/", "2026-05-10");
    insertClub.run(4, "Queens Park Rangers", 69, "Queens Park Rangers FC|Queens Park Rangers|QPR", "QPR", "ELC", 2, "https://www.qpr.co.uk/", "https://www.eticketing.co.uk/qpr/", "https://www.eticketing.co.uk/qpr/", "2026-05-10");
    insertClub.run(5, "Norwich City", 68, "Norwich City FC|Norwich City|Norwich", "Norwich", "ELC", 5, "https://www.canaries.co.uk/", "https://tickets.canaries.co.uk/", "https://tickets.canaries.co.uk/", "2026-05-10");
    insertClub.run(6, "Birmingham City", 332, "Birmingham City FC|Birmingham City|Birmingham", "Birmingham", "ELC", 6, "https://www.bcfc.com/", "https://www.bcfc.com/tickets/", "https://www.bcfc.com/tickets/", "2026-05-10");

    const insertPrice = db.prepare(`
      INSERT INTO admission_prices (club_id, label, amount_pence, source_url, verified_at, confidence)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(club_id, label) DO UPDATE SET
        amount_pence = excluded.amount_pence,
        source_url = excluded.source_url,
        verified_at = excluded.verified_at,
        confidence = excluded.confidence
    `);
    insertPrice.run(1, "Adult from", 3000, "https://www.chelseafc.com/en/tickets", "2026-05-10", "seed");
    insertPrice.run(2, "Adult from", 2800, "https://www.arsenal.com/tickets", "2026-05-10", "seed");
    insertPrice.run(3, "Adult from", 3100, "https://tickets.manutd.com/", "2026-05-10", "seed");
    insertPrice.run(4, "Adult from", 2200, "https://www.eticketing.co.uk/qpr/", "2026-05-10", "seed");
    insertPrice.run(5, "Adult from", 2500, "https://tickets.canaries.co.uk/", "2026-05-10", "seed");
    insertPrice.run(6, "Adult from", 2000, "https://www.bcfc.com/tickets/", "2026-05-10", "seed");

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
    insertFixture.run("historical_seed", "pl-che-ars-2025-05-18", "PL", 1, 2, 1, "2025-05-18T15:00:00.000Z", "finished", 1, 1);
    insertFixture.run("historical_seed", "elc-qpr-nor-2025-05-03", "ELC", 4, 5, 2, "2025-05-03T14:00:00.000Z", "finished", 1, 1);
    insertFixture.run("historical_seed", "pl-mut-che-2025-05-25", "PL", 3, 1, 4, "2025-05-25T15:00:00.000Z", "finished", 1, 1);
    insertFixture.run("historical_seed", "elc-bir-qpr-2025-04-26", "ELC", 6, 4, 6, "2025-04-26T14:00:00.000Z", "finished", 1, 1);

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
    insertTravel.run("SW6", 1, 0.4, 6, 8, "seed", now);
    insertTravel.run("SW6", 2, 3.7, 22, 28, "seed", now);
    insertTravel.run("SW6", 3, 8.8, 42, 43, "seed", now);
    insertTravel.run("W12", 1, 3.5, 20, 27, "seed", now);
    insertTravel.run("W12", 2, 0.3, 4, 6, "seed", now);
    insertTravel.run("M16", 4, 0.3, 4, 7, "seed", now);
  });

  seed();
}
