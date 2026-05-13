import type { Database as SqliteDatabase } from "better-sqlite3";

export function seedE2eFixtures(db: SqliteDatabase): void {
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
