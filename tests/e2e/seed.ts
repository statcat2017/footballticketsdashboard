import type { Database as SqliteDatabase } from "better-sqlite3";

export function seedE2eFixtures(db: SqliteDatabase): void {
  const insertTravelCache = db.prepare(`
    INSERT INTO travel_cache (
      postcode_district, venue_id, distance_miles, driving_minutes,
      public_transport_minutes, provider, calculated_at
    ) VALUES (?, ?, 1, 10, 12, 'e2e-mock', '2026-10-19T00:00:00.000Z')
    ON CONFLICT(postcode_district, venue_id) DO UPDATE SET
      distance_miles = excluded.distance_miles,
      driving_minutes = excluded.driving_minutes,
      public_transport_minutes = excluded.public_transport_minutes,
      provider = excluded.provider,
      calculated_at = excluded.calculated_at
  `);
  for (const district of ["SE20", "SW6"]) {
    for (const venueId of [1, 2, 3, 4, 6]) {
      insertTravelCache.run(district, venueId);
    }
  }

  const insertFixture = db.prepare(`
    INSERT INTO fixtures (
      source, source_id, competition_code, home_club_id, away_club_id,
      venue_id, kickoff_at, status, is_demo_data, is_historical
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

  const demoDate = new Date();
  demoDate.setDate(demoDate.getDate() + 5);

  insertFixture.run("seed_demo", "e2e-live", "PL", 1, 2, 1, demoDate.toISOString(), "scheduled", 0, 0);
}
