import type { Database as SqliteDatabase } from "better-sqlite3";

export function seedE2eFixtures(db: SqliteDatabase): void {
  db.prepare(`
    INSERT INTO fixture_seasons (label, starts_on, ends_on, is_current)
    VALUES ('2026-27', '2026-07-01', '2027-06-30', 1)
    ON CONFLICT(label) DO UPDATE SET
      starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      is_current = excluded.is_current
  `).run();

  db.prepare("UPDATE club_ticket_prices SET season_label = '2025-26' WHERE club_id = 1").run();

  const insertFixture = db.prepare(`
    INSERT INTO fixtures (
      source, source_id, competition_code, home_club_id, away_club_id,
      venue_id, kickoff_at, fixture_date, kickoff_time, kickoff_time_status,
      season_label, status, is_demo_data, is_historical
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '15:00', 'confirmed', '2026-27', ?, ?, ?)
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
  demoDate.setUTCDate(demoDate.getUTCDate() + 5);
  const otherDate = new Date();
  otherDate.setUTCDate(otherDate.getUTCDate() + 6);
  const staleDate = new Date();
  staleDate.setUTCDate(staleDate.getUTCDate() + 7);

  insertFixture.run("seed_demo", "e2e-live", "PL", 1, 2, 1, `${demoDate.toISOString().slice(0, 10)}T15:00:00.000Z`, demoDate.toISOString().slice(0, 10), "scheduled", 0, 0);
  insertFixture.run("seed_demo", "e2e-other", "PL", 1, 4, 1, `${otherDate.toISOString().slice(0, 10)}T15:00:00.000Z`, otherDate.toISOString().slice(0, 10), "scheduled", 0, 0);
  insertFixture.run("seed_demo", "e2e-stale", "PL", 1, 6, 1, `${staleDate.toISOString().slice(0, 10)}T15:00:00.000Z`, staleDate.toISOString().slice(0, 10), "scheduled", 0, 0);

  const fixtureId = db.prepare(`
    SELECT id FROM fixtures WHERE source = 'seed_demo' AND source_id = 'e2e-live'
  `).get() as { id: number };
  const staleFixture = db.prepare(`
    SELECT id FROM fixtures WHERE source = 'seed_demo' AND source_id = 'e2e-stale'
  `).get() as { id: number };

  db.prepare(`
    INSERT INTO fixture_ticket_price_overrides (
      fixture_id, sale_mode, adult_price_pence, concession_price_pence,
      source_url, verified_at, note, confidence, season_label
    ) VALUES (?, 'pay_on_gate', 1250, NULL, 'https://prices.example.test/chelsea/e2e-live', NULL, 'Test partial fixture price', 'verified', NULL)
  `).run(fixtureId.id);

  const insertOneOff = db.prepare(`
    INSERT INTO fixtures (
      source, source_id, competition_code, venue_id, kickoff_at, fixture_date,
      kickoff_time_status, season_label, status, is_demo_data, is_historical,
      home_one_off, away_one_off, home_one_off_name, away_one_off_name
    ) VALUES ('seed_demo', ?, 'PL', 1, ?, ?, 'unknown', '2026-27', 'scheduled', 0, 0, 1, 1, ?, ?)
  `);
  const noPriceDate = new Date();
  noPriceDate.setUTCDate(noPriceDate.getUTCDate() + 8);
  const noCheckedDate = new Date();
  noCheckedDate.setUTCDate(noCheckedDate.getUTCDate() + 9);
  insertOneOff.run(
    "e2e-no-price",
    `${noPriceDate.toISOString().slice(0, 10)}T15:00:00.000Z`,
    noPriceDate.toISOString().slice(0, 10),
    "No Price Home",
    "No Price Away"
  );
  insertOneOff.run(
    "e2e-no-check",
    `${noCheckedDate.toISOString().slice(0, 10)}T15:00:00.000Z`,
    noCheckedDate.toISOString().slice(0, 10),
    "No Check Home",
    "No Check Away"
  );

  db.prepare(`
    INSERT INTO fixture_ticket_price_overrides (
      fixture_id, sale_mode, adult_price_pence, source_url, verified_at, note, confidence, season_label
    ) VALUES (?, 'pay_on_gate', 2500, 'https://prices.example.test/chelsea/stale', ?, 'Stale price test', 'verified', '2026-27')
  `).run(staleFixture.id, daysAgo(91));

  const noCheckedPriceFixture = db.prepare(`
    SELECT id FROM fixtures WHERE source = 'seed_demo' AND source_id = 'e2e-no-check'
  `).get() as { id: number };

  db.prepare(`
    INSERT INTO fixture_ticket_price_overrides (
      fixture_id, sale_mode, adult_price_pence, source_url, verified_at, note, confidence, season_label
    ) VALUES (?, 'pay_on_gate', 900, 'https://prices.example.test/one-off/no-check', NULL, 'Missing check date test', 'verified', '2026-27')
  `).run(noCheckedPriceFixture.id);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
