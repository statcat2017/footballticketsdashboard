import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { createSqliteAppDatabase } from "@/lib/db/adapter";
import type { AppDatabase } from "@/lib/db/adapter";
import { applySchema } from "@/lib/db/setup";
import { findImportFixtureMatch } from "@/lib/import/fixtureIdentity";
import type { ImportBatchRow } from "@/lib/import/types";

function setupTestDb(): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  applySchema(sqlite);
  const db = createSqliteAppDatabase(sqlite);

  db.exec(`
    INSERT INTO competitions (code, name, tier) VALUES ('PL', 'Premier League', 1);
    INSERT INTO fixture_seasons (id, label, starts_on, ends_on, is_current) VALUES (1, '2025-26', '2025-08-01', '2026-07-31', 1);
    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (1, 'V', 'TE1 1ST', 51.5, -0.1);
    INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (1, 'Chelsea', 'PL', 1);
    INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (2, 'Arsenal', 'PL', 1);

    -- Normal two-club fixture
    INSERT INTO fixtures (id, source, source_id, competition_code, home_club_id, away_club_id, venue_id, fixture_date, kickoff_time, kickoff_time_status, season_label, status, is_demo_data, is_historical, home_one_off, away_one_off, confidence)
    VALUES (100, 'test', 'f1', 'PL', 1, 2, 1, '2026-05-20', '15:00', 'confirmed', '2025-26', 'scheduled', 0, 0, 0, 0, 'imported');

    -- One-off home fixture
    INSERT INTO fixtures (id, source, source_id, competition_code, home_one_off_name, away_club_id, venue_id, fixture_date, kickoff_time, kickoff_time_status, season_label, status, is_demo_data, is_historical, home_one_off, away_one_off, confidence)
    VALUES (101, 'test', 'f2', 'PL', 'Barcelona XI', 1, 1, '2026-06-01', '19:45', 'confirmed', '2025-26', 'scheduled', 0, 0, 1, 0, 'imported');

    -- Both one-off fixture
    INSERT INTO fixtures (id, source, source_id, competition_code, home_one_off_name, away_one_off_name, venue_id, fixture_date, kickoff_time, kickoff_time_status, season_label, status, is_demo_data, is_historical, home_one_off, away_one_off, confidence)
    VALUES (102, 'test', 'f3', 'PL', 'Select XI', 'World XI', 1, '2026-07-01', '15:00', 'confirmed', '2025-26', 'scheduled', 0, 0, 1, 1, 'imported');

    -- Duplicate normal fixtures (should return ambiguous)
    INSERT INTO fixtures (id, source, source_id, competition_code, home_club_id, away_club_id, venue_id, fixture_date, kickoff_time, kickoff_time_status, season_label, status, is_demo_data, is_historical, home_one_off, away_one_off, confidence)
    VALUES (103, 'test', 'f4', 'PL', 2, 1, 1, '2026-08-01', '15:00', 'confirmed', '2025-26', 'scheduled', 0, 0, 0, 0, 'imported');
    INSERT INTO fixtures (id, source, source_id, competition_code, home_club_id, away_club_id, venue_id, fixture_date, kickoff_time, kickoff_time_status, season_label, status, is_demo_data, is_historical, home_one_off, away_one_off, confidence)
    VALUES (104, 'test', 'f5', 'PL', 2, 1, 1, '2026-08-01', '15:00', 'confirmed', '2025-26', 'scheduled', 0, 0, 0, 0, 'imported');

    -- Duplicate one-off fixtures (should return ambiguous)
    INSERT INTO fixtures (id, source, source_id, competition_code, home_one_off_name, away_club_id, venue_id, fixture_date, kickoff_time, kickoff_time_status, season_label, status, is_demo_data, is_historical, home_one_off, away_one_off, confidence)
    VALUES (105, 'test', 'f6', 'PL', 'Tourists FC', 2, 1, '2026-09-01', '15:00', 'confirmed', '2025-26', 'scheduled', 0, 0, 1, 0, 'imported');
    INSERT INTO fixtures (id, source, source_id, competition_code, home_one_off_name, away_club_id, venue_id, fixture_date, kickoff_time, kickoff_time_status, season_label, status, is_demo_data, is_historical, home_one_off, away_one_off, confidence)
    VALUES (106, 'test', 'f7', 'PL', 'Tourists FC', 2, 1, '2026-09-01', '15:00', 'confirmed', '2025-26', 'scheduled', 0, 0, 1, 0, 'imported');
  `);

  return db;
}

function row(overrides: Partial<ImportBatchRow> = {}): ImportBatchRow {
  return {
    id: 0,
    batchId: 0,
    rowIndex: 0,
    homeParticipantRaw: null,
    awayParticipantRaw: null,
    homeParticipantResolvedId: null,
    awayParticipantResolvedId: null,
    homeIsOneOff: false,
    awayIsOneOff: false,
    competitionRaw: null,
    competitionResolvedCode: null,
    venueRaw: null,
    venueResolvedId: null,
    kickoffDate: null,
    kickoffTime: null,
    status: null,
    ticketUrl: null,
    adultPricePence: null,
    concessionPricePence: null,
    sourceUrl: null,
    evidenceJson: null,
    confidence: "imported",
    matchResult: null,
    warningsJson: null,
    finalAction: null,
    finalFixtureId: null,
    createdAt: "",
    ...overrides,
  };
}

describe("findImportFixtureMatch", () => {
  it("matches two normal clubs by home, away, competition, season, and date", async () => {
    const db = setupTestDb();
    const match = await findImportFixtureMatch(db, row({
      homeParticipantResolvedId: 1,
      awayParticipantResolvedId: 2,
      competitionResolvedCode: "PL",
      kickoffDate: "2026-05-20",
    }), "2025-26");

    expect(match.kind).toBe("match");
    if (match.kind !== "match") return;
    expect(match.id).toBe(100);
    expect(match.before.competition_code).toBe("PL");
  });

  it("returns none when competition code is missing", async () => {
    const db = setupTestDb();
    const match = await findImportFixtureMatch(db, row({
      homeParticipantResolvedId: 1,
      awayParticipantResolvedId: 2,
      competitionResolvedCode: null,
    }), "2025-26");

    expect(match.kind).toBe("none");
  });

  it("matches home one-off fixture by one-off name and away club", async () => {
    const db = setupTestDb();
    const match = await findImportFixtureMatch(db, row({
      homeIsOneOff: true,
      homeParticipantRaw: "Barcelona XI",
      awayParticipantResolvedId: 1,
      competitionResolvedCode: "PL",
    }), "2025-26");

    expect(match.kind).toBe("match");
    if (match.kind !== "match") return;
    expect(match.id).toBe(101);
  });

  it("matches both one-off fixture by names", async () => {
    const db = setupTestDb();
    const match = await findImportFixtureMatch(db, row({
      homeIsOneOff: true,
      awayIsOneOff: true,
      homeParticipantRaw: "Select XI",
      awayParticipantRaw: "World XI",
      competitionResolvedCode: "PL",
    }), "2025-26");

    expect(match.kind).toBe("match");
    if (match.kind !== "match") return;
    expect(match.id).toBe(102);
  });

  it("returns ambiguous for duplicate normal fixtures", async () => {
    const db = setupTestDb();
    const match = await findImportFixtureMatch(db, row({
      homeParticipantResolvedId: 2,
      awayParticipantResolvedId: 1,
      competitionResolvedCode: "PL",
      kickoffDate: "2026-08-01",
    }), "2025-26");

    expect(match.kind).toBe("ambiguous");
    if (match.kind !== "ambiguous") return;
    expect(match.count).toBe(2);
  });

  it("returns ambiguous for duplicate home one-off fixtures", async () => {
    const db = setupTestDb();
    const match = await findImportFixtureMatch(db, row({
      homeIsOneOff: true,
      homeParticipantRaw: "Tourists FC",
      awayParticipantResolvedId: 2,
      competitionResolvedCode: "PL",
    }), "2025-26");

    expect(match.kind).toBe("ambiguous");
    if (match.kind !== "ambiguous") return;
    expect(match.count).toBe(2);
  });

  it("returns none when no fixture matches", async () => {
    const db = setupTestDb();
    const match = await findImportFixtureMatch(db, row({
      homeParticipantResolvedId: 1,
      awayParticipantResolvedId: 2,
      competitionResolvedCode: "ELC",
      kickoffDate: "2026-05-20",
    }), "2025-26");

    expect(match.kind).toBe("none");
  });

  it("includes before state from the matched fixture", async () => {
    const db = setupTestDb();
    const match = await findImportFixtureMatch(db, row({
      homeParticipantResolvedId: 1,
      awayParticipantResolvedId: 2,
      competitionResolvedCode: "PL",
      kickoffDate: "2026-05-20",
    }), "2025-26");

    expect(match.kind).toBe("match");
    if (match.kind !== "match") return;
    expect(match.before.fixture_date).toBe("2026-05-20");
    expect(match.before.kickoff_time).toBe("15:00");
    expect(match.before.kickoff_time_status).toBe("confirmed");
  });

  it("returns ambiguous for duplicate both one-off fixtures", async () => {
    const db = setupTestDb();
    db.exec(`
      INSERT INTO fixtures (id, source, source_id, competition_code, home_one_off_name, away_one_off_name, venue_id, fixture_date, kickoff_time, kickoff_time_status, season_label, status, is_demo_data, is_historical, home_one_off, away_one_off, confidence)
      VALUES (107, 'test', 'f8', 'PL', 'Select XI', 'World XI', 1, '2026-07-01', '15:00', 'confirmed', '2025-26', 'scheduled', 0, 0, 1, 1, 'imported');
    `);
    const match = await findImportFixtureMatch(db, row({
      homeIsOneOff: true,
      awayIsOneOff: true,
      homeParticipantRaw: "Select XI",
      awayParticipantRaw: "World XI",
      competitionResolvedCode: "PL",
    }), "2025-26");

    expect(match.kind).toBe("ambiguous");
    if (match.kind !== "ambiguous") return;
    expect(match.count).toBe(2);
  });
});
