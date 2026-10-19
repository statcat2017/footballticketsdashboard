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

  const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const startedAt = `${currentDate}T00:00:00.000Z`;
  const fixtureInsert = db.prepare(`
    INSERT INTO fixtures (
      source, source_id, competition_code, home_club_id, away_club_id, venue_id,
      kickoff_at, fixture_date, kickoff_time, kickoff_time_status, status,
      is_demo_data, is_historical, home_one_off, away_one_off, away_one_off_name
    )
    VALUES ('seed_demo', ?, 'PL', 1, NULL, 1, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?)
  `);
  const nextDay = (daysAhead: number): string => {
    const date = new Date(`${currentDate}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + daysAhead);
    return date.toISOString().slice(0, 10);
  };

  fixtureInsert.run("e2e-started", startedAt, currentDate, null, "unknown", "scheduled", 1, "Already Started Opponent");
  fixtureInsert.run("e2e-postponed", `${nextDay(6)}T15:00:00.000Z`, nextDay(6), "15:00", "assumed", "postponed", 1, "Postponed Opponent");
  fixtureInsert.run("e2e-cancelled", `${nextDay(7)}T15:00:00.000Z`, nextDay(7), "15:00", "confirmed", "cancelled", 0, "Cancelled Opponent");
  fixtureInsert.run("e2e-unknown", `${nextDay(8)}T15:00:00.000Z`, nextDay(8), null, "unknown", "unknown", 0, "Unknown Status Opponent");
  fixtureInsert.run("e2e-finished", `${nextDay(9)}T15:00:00.000Z`, nextDay(9), "15:00", "confirmed", "finished", 0, "Finished Opponent");

  const missingPriceDate = nextDay(10);
  db.prepare(`
    INSERT INTO fixtures (
      source, source_id, competition_code, venue_id, kickoff_at, fixture_date,
      kickoff_time, kickoff_time_status, status, is_demo_data, is_historical,
      home_one_off, away_one_off, home_one_off_name, away_one_off_name
    )
    VALUES ('seed_demo', 'e2e-missing-price', 'PL', 1, ?, ?, NULL, 'unknown', 'scheduled', 0, 0, 1, 1, 'No Price Home', 'No Price Away')
  `).run(`${missingPriceDate}T15:00:00.000Z`, missingPriceDate);

  db.prepare("UPDATE venues SET is_approximate = 1, coordinate_precision = 'ground_approximate' WHERE id = 1").run();
}
