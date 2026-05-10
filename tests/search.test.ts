import { describe, expect, it } from "vitest";

import { createDatabase } from "@/lib/db/client";
import { searchFixtures } from "@/lib/search/service";

describe("fixture search", () => {
  it("falls back to historical demo fixtures when the live date range is empty", () => {
    const db = createDatabase();

    const results = searchFixtures(db, {
      postcode: "SW6 1HS",
      radiusMiles: 20,
      dateFrom: "2026-05-10",
      dateTo: "2026-05-24"
    });

    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some((result) => result.competitionCode === "PL")).toBe(true);
    expect(results.some((result) => result.competitionCode === "ELC")).toBe(true);
    expect(results.every((result) => result.isHistorical)).toBe(true);
    expect(results[0].travel.distanceMiles).toBeLessThanOrEqual(results[1].travel.distanceMiles);
  });

  it("keeps search working when no cached travel time exists", () => {
    const db = createDatabase();

    const results = searchFixtures(db, {
      postcode: "N5 1BU",
      radiusMiles: 200,
      dateFrom: "2026-05-10",
      dateTo: "2026-05-24"
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.travel.source === "distance_only")).toBe(true);
  });
});
