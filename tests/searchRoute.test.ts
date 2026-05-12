import { afterEach, describe, expect, it, vi } from "vitest";

const getDatabase = vi.fn();
const searchFixtures = vi.fn();
const defaultDateRange = vi.fn(() => ({
  dateFrom: "2026-05-11",
  dateTo: "2026-05-21"
}));
const scheduleSearchTravelBackfill = vi.fn();

vi.mock("@/lib/db/client", () => ({
  getDatabase
}));

vi.mock("@/lib/date", () => ({
  defaultDateRange
}));

vi.mock("@/lib/search/service", () => ({
  searchFixtures
}));

vi.mock("@/lib/travel/backfill", () => ({
  scheduleSearchTravelBackfill
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("search API route", () => {
  it("returns a 400 for invalid input", async () => {
    const { POST } = await import("@/app/api/search/route");

    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcode: "bad", radiusMiles: -1 })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a valid UK postcode."
    });
    expect(searchFixtures).not.toHaveBeenCalled();
    expect(scheduleSearchTravelBackfill).not.toHaveBeenCalled();
  });

  it("returns a 400 for malformed dates", async () => {
    const { POST } = await import("@/app/api/search/route");

    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        postcode: "SW6 1HS",
        dateFrom: "2026-13-01",
        dateTo: "2026-05-21"
      })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a valid start date in YYYY-MM-DD format."
    });
  });

  it("returns a 400 when the date range is reversed", async () => {
    const { POST } = await import("@/app/api/search/route");

    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        postcode: "SW6 1HS",
        dateFrom: "2026-05-21",
        dateTo: "2026-05-11"
      })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "End date must be on or after the start date."
    });
  });

  it("applies the default date range and returns route metadata", async () => {
    const db = { kind: "db" };
    getDatabase.mockResolvedValue(db);
    searchFixtures.mockResolvedValue([
      {
        id: 1,
        title: "Chelsea vs Arsenal",
        competitionCode: "PL",
        competitionName: "Premier League",
        kickoffAt: "2026-05-12T19:00:00.000Z",
        venueName: "Stamford Bridge",
        venuePostcode: "SW6 1HS",
        homeClub: "Chelsea",
        awayClub: "Arsenal",
        officialSiteUrl: "https://www.chelseafc.com/",
        genericTicketUrl: "https://www.chelseafc.com/en/tickets",
        price: {
          saleMode: "all_ticket",
          adultPricePence: 3000,
          concessionPricePence: 2000,
          sourceUrl: "https://www.chelseafc.com/en/tickets",
          verifiedAt: "2026-05-10",
          confidence: "seed",
          isOverride: false
        },
        travel: {
          distanceMiles: 0.4,
          drivingMinutes: 6,
          publicTransportMinutes: 8,
          source: "cache"
        },
        isDemoData: false,
        isHistorical: false,
        warnings: []
      }
    ]);

    const { POST } = await import("@/app/api/search/route");

    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcode: "SW6 1HS", radiusMiles: 25 })
    }));

    expect(searchFixtures).toHaveBeenCalledWith(db, {
      postcode: "SW6 1HS",
      radiusMiles: 25,
      dateFrom: "2026-05-11",
      dateTo: "2026-05-21"
    }, {
      travelProviders: {
        openRouteServiceApiKey: undefined,
        travelTimeAppId: undefined,
        travelTimeApiKey: undefined
      }
    });
    expect(scheduleSearchTravelBackfill).toHaveBeenCalledWith(db, {
      postcode: "SW6 1HS",
      dateFrom: "2026-05-11",
      dateTo: "2026-05-21"
    }, {
      openRouteServiceApiKey: undefined,
      travelTimeAppId: undefined,
      travelTimeApiKey: undefined
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      results: [
        expect.objectContaining({
          title: "Chelsea vs Arsenal",
          price: expect.objectContaining({
            saleMode: "all_ticket",
            adultPricePence: 3000,
            concessionPricePence: 2000
          })
        })
      ],
      meta: {
        dateFrom: "2026-05-11",
        dateTo: "2026-05-21",
        radiusMiles: 25,
        usedHistoricalFallback: false
      }
    });
  });

  it("returns a 400 when the search service raises an input error", async () => {
    const db = { kind: "db" };
    getDatabase.mockResolvedValue(db);
    searchFixtures.mockRejectedValue(new Error("Unknown postcode district."));

    const { POST } = await import("@/app/api/search/route");

    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcode: "ZZ1 1ZZ" })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Unknown postcode district."
    });
    expect(scheduleSearchTravelBackfill).not.toHaveBeenCalled();
  });

  it("returns a 500 for unexpected backend failures", async () => {
    const db = { kind: "db" };
    getDatabase.mockResolvedValue(db);
    searchFixtures.mockRejectedValue(new Error("Database offline"));

    const { POST } = await import("@/app/api/search/route");

    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcode: "SW6 1HS" })
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Search failed."
    });
    expect(scheduleSearchTravelBackfill).not.toHaveBeenCalled();
  });
});
