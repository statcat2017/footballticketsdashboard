import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResolvedPostcodeOrigin } from "@/lib/postcode";

const getDatabase = vi.fn();
const searchFixtures = vi.fn();
const resolveSearchOrigin = vi.fn();
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
  searchFixtures,
  resolveSearchOrigin
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

  it("returns a 400 for a non-UK postcode format", async () => {
    const { POST } = await import("@/app/api/search/route");

    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcode: "12345" })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a valid UK postcode."
    });
    expect(searchFixtures).not.toHaveBeenCalled();
    expect(scheduleSearchTravelBackfill).not.toHaveBeenCalled();
  });

  it("returns a 400 for invalid postcode characters", async () => {
    const { POST } = await import("@/app/api/search/route");

    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcode: "!!!!!!" })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a valid UK postcode."
    });
    expect(searchFixtures).not.toHaveBeenCalled();
    expect(scheduleSearchTravelBackfill).not.toHaveBeenCalled();
  });

  it("returns a 400 for a too-short postcode", async () => {
    const { POST } = await import("@/app/api/search/route");

    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcode: "A1" })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a valid UK postcode."
    });
    expect(searchFixtures).not.toHaveBeenCalled();
    expect(scheduleSearchTravelBackfill).not.toHaveBeenCalled();
  });

  it("returns a 400 for a valid-format postcode that the service rejects as unknown", async () => {
    const db = { kind: "db" };
    getDatabase.mockResolvedValue(db);
    searchFixtures.mockRejectedValue(new Error("Enter a valid postcode district."));
    resolveSearchOrigin.mockResolvedValue(knownOrigin("ZZ1 1ZZ"));

    const { POST } = await import("@/app/api/search/route");

    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcode: "ZZ1 1ZZ" })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a valid postcode district."
    });
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
    const origin = knownOrigin("SW6 1HS");
    getDatabase.mockResolvedValue(db);
    resolveSearchOrigin.mockResolvedValue(origin);
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
          publicTransportUrl: "https://www.google.com/maps/dir/?api=1&origin=51.4817%2C-0.191&destination=51.4817%2C-0.191&travelmode=transit&dir_action=navigate",
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
      dateTo: "2026-05-21",
      allowApproximateOrigin: false
    }, {
      travelProviders: {
        openRouteServiceApiKey: undefined,
        travelTimeAppId: undefined,
        travelTimeApiKey: undefined
      },
      resolvedOrigin: origin,
      allowApproximateOrigin: false
    });
    expect(resolveSearchOrigin).toHaveBeenCalledWith("SW6 1HS");
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
        originSource: "known",
        approximateOrigin: false,
        usedHistoricalFallback: false
      }
    });
  });

  it("requires a choice before searching from an approximate district origin", async () => {
    const fallback: ResolvedPostcodeOrigin = {
      normalized: "B75 5AQ",
      district: "B75",
      coordinate: { latitude: 52.497718, longitude: -1.9040670000000002 },
      source: "fallback"
    };
    resolveSearchOrigin.mockResolvedValue(fallback);

    const { POST } = await import("@/app/api/search/route");
    const request = () => new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcode: "B75 5AQ" })
    });

    const response = await POST(request());
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "postcode_unresolved",
      canUseApproximateOrigin: true
    });
    expect(searchFixtures).not.toHaveBeenCalled();
    expect(scheduleSearchTravelBackfill).not.toHaveBeenCalled();
  });

  it("returns a 500 when the search service raises an input error", async () => {
    const db = { kind: "db" };
    resolveSearchOrigin.mockResolvedValue(knownOrigin("ZZ1 1ZZ"));
    getDatabase.mockResolvedValue(db);
    searchFixtures.mockRejectedValue(new Error("Unknown postcode district."));

    const { POST } = await import("@/app/api/search/route");

    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcode: "ZZ1 1ZZ" })
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Search failed."
    });
    expect(scheduleSearchTravelBackfill).not.toHaveBeenCalled();
  });

  it("returns a 500 for unexpected backend failures", async () => {
    const db = { kind: "db" };
    resolveSearchOrigin.mockResolvedValue(knownOrigin("SW6 1HS"));
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

function knownOrigin(postcode: string): ResolvedPostcodeOrigin {
  return {
    normalized: postcode,
    district: postcode.split(" ")[0],
    coordinate: { latitude: 51.4817, longitude: -0.191 },
    source: "known"
  };
}
