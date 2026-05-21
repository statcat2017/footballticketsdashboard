import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppDatabase } from "@/lib/db/client";
import { searchFixtures } from "@/lib/search/service";
import type { PostcodeResolver } from "@/lib/postcode";
import type { TravelProvider } from "@/lib/travel/providers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("search service substitutable seams", () => {
  it("accepts a mock PostcodeResolver override", async () => {
    const db = createAppDatabase();

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'seam-chelsea', 'PL', 1, 2, 1, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const mockResolver: PostcodeResolver = {
      resolve: async () => ({ latitude: 51.4817, longitude: -0.191 })
    };

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, { postcodeResolver: mockResolver });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toBe("Chelsea vs Arsenal");
  });

  it("accepts a mock TravelProvider override", async () => {
    const db = createAppDatabase();

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'seam-travel', 'ELC', 6, 4, 6, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const mockResolver: PostcodeResolver = {
      resolve: async () => ({ latitude: 52.474936, longitude: -1.864108 })
    };

    const mockTravel: TravelProvider = {
      estimate: async () => ({
        drivingMinutes: 45,
        publicTransportMinutes: null,
        provider: "mock-driving"
      })
    };

    const results = await searchFixtures(db, {
      postcode: "B9 4RL",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, {
      postcodeResolver: mockResolver,
      travelProviderOverrides: [mockTravel]
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.travel.drivingMinutes).toBe(45);
    expect(results[0]?.travel.source).toBe("live");
  });

  it("combines multiple mock TravelProviders", async () => {
    const db = createAppDatabase();

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'seam-multi', 'ELC', 6, 4, 6, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const mockResolver: PostcodeResolver = {
      resolve: async () => ({ latitude: 52.474936, longitude: -1.864108 })
    };

    const mockDriving: TravelProvider = {
      estimate: async () => ({
        drivingMinutes: 30,
        publicTransportMinutes: null,
        provider: "mock-driving"
      })
    };

    const mockTransit: TravelProvider = {
      estimate: async () => ({
        drivingMinutes: null,
        publicTransportMinutes: 60,
        provider: "mock-transit"
      })
    };

    const results = await searchFixtures(db, {
      postcode: "B9 4RL",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, {
      postcodeResolver: mockResolver,
      travelProviderOverrides: [mockDriving, mockTransit]
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.travel.drivingMinutes).toBe(30);
    expect(results[0]?.travel.publicTransportMinutes).toBe(60);
  });

  it("falls back to default PostcodeResolver when none provided", async () => {
    const db = createAppDatabase();

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'seam-fallback', 'PL', 1, 2, 1, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toBe("Chelsea vs Arsenal");
  });

  it("falls back gracefully when PostcodeResolver returns null", async () => {
    const db = createAppDatabase();

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'seam-null-resolver', 'PL', 1, 2, 1, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const nullResolver: PostcodeResolver = {
      resolve: async () => null
    };

    const results = await searchFixtures(db, {
      postcode: "ZZ99 9ZZ",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, { postcodeResolver: nullResolver });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toBe("Chelsea vs Arsenal");
  });

  it("continues when TravelProvider estimate returns null", async () => {
    const db = createAppDatabase();

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'seam-null-estimate', 'ELC', 6, 4, 6, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const mockResolver: PostcodeResolver = {
      resolve: async () => ({ latitude: 52.474936, longitude: -1.864108 })
    };

    const nullProvider: TravelProvider = {
      estimate: async () => null
    };

    const goodProvider: TravelProvider = {
      estimate: async () => ({
        drivingMinutes: 55,
        publicTransportMinutes: null,
        provider: "good-provider"
      })
    };

    const results = await searchFixtures(db, {
      postcode: "B9 4RL",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, {
      postcodeResolver: mockResolver,
      travelProviderOverrides: [nullProvider, goodProvider]
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.travel.drivingMinutes).toBe(55);
  });

  it("continues when TravelProvider estimate rejects", async () => {
    const db = createAppDatabase();

    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES ('test', 'seam-reject-estimate', 'ELC', 6, 4, 6, '2026-05-12T19:00:00.000Z', 'scheduled', 0, 0)
    `);

    const mockResolver: PostcodeResolver = {
      resolve: async () => ({ latitude: 52.474936, longitude: -1.864108 })
    };

    const failingProvider: TravelProvider = {
      estimate: async () => {
        throw new Error("provider unavailable");
      }
    };

    const goodProvider: TravelProvider = {
      estimate: async () => ({
        drivingMinutes: 40,
        publicTransportMinutes: null,
        provider: "good-provider"
      })
    };

    const results = await searchFixtures(db, {
      postcode: "B9 4RL",
      dateFrom: "2026-05-10",
      dateTo: "2026-05-20"
    }, {
      postcodeResolver: mockResolver,
      travelProviderOverrides: [failingProvider, goodProvider]
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.travel.drivingMinutes).toBe(40);
  });
});
