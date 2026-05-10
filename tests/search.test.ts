import { describe, expect, it } from "vitest";

import { createDatabase } from "@/lib/db/client";
import { searchFixtures } from "@/lib/search/service";

describe("fixture search", () => {
  it("does not fall back to historical demo fixtures when the live date range is empty", () => {
    const db = createDatabase();

    const results = searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    });

    expect(results).toEqual([]);
  });

  it("returns live fixtures sorted by distance when no radius is supplied", () => {
    const db = createDatabase();
    db.prepare(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES
        ('test', 'chelsea-live', 'PL', 1, 2, 1, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0),
        ('test', 'birmingham-live', 'ELC', 6, 4, 6, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `).run();

    const results = searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    });

    expect(results.map((result) => result.title)).toEqual([
      "Chelsea vs Arsenal",
      "Birmingham City vs Queens Park Rangers"
    ]);
    expect(results.some((result) => result.travel.source === "distance_only")).toBe(true);
  });
});
