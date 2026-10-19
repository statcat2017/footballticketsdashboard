import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppDatabase } from "@/lib/db/client";
import { searchFixtures } from "@/lib/search/service";
import type { PostcodeResolver } from "@/lib/postcode";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function insertFixture(db: Awaited<ReturnType<typeof createAppDatabase>>, sourceId: string) {
  await db.run(`
    INSERT INTO fixtures (
      source, source_id, competition_code, home_club_id, away_club_id, venue_id,
      kickoff_at, status, is_demo_data, is_historical
    )
    VALUES ('test', ?, 'PL', 1, 2, 1, '2030-05-12T19:00:00.000Z', 'scheduled', 0, 0)
  `, [sourceId]);
}

describe("search service seams", () => {
  it("accepts an injected postcode resolver and never calls travel providers", async () => {
    const db = await createAppDatabase();
    await insertFixture(db, "postcode-seam");
    await db.run("DELETE FROM travel_cache WHERE postcode_district = 'SW6' AND venue_id = 1");
    const fetchMock = vi.fn<typeof fetch>(() => Promise.reject(new Error("unexpected provider request")));
    vi.stubGlobal("fetch", fetchMock);
    const resolver: PostcodeResolver = {
      resolve: async () => ({ latitude: 51.4817, longitude: -0.191 })
    };

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2030-05-10",
      dateTo: "2030-05-20"
    }, { postcodeResolver: resolver });

    expect(results[0]?.title).toBe("Chelsea vs Arsenal");
    expect(results[0]?.travel.source).toBe("distance_only");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses postcode-district fallback when resolution returns null", async () => {
    const db = await createAppDatabase();
    await insertFixture(db, "postcode-fallback");
    const resolver: PostcodeResolver = { resolve: async () => null };

    const results = await searchFixtures(db, {
      postcode: "ZZ99 9ZZ",
      dateFrom: "2030-05-10",
      dateTo: "2030-05-20"
    }, { postcodeResolver: resolver });

    expect(results[0]?.title).toBe("Chelsea vs Arsenal");
    expect(results[0]?.travel).toMatchObject({
      postcodeDistrict: "ZZ99",
      isDistrictApproximate: true,
      source: "distance_only"
    });
  });
});
