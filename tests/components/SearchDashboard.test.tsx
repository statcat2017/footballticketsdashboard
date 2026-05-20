import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchDashboard } from "@/app/components/SearchDashboard";
import type { FixtureResult } from "@/lib/types";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn() }
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SearchDashboard", () => {
  it("renders the search form controls", () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    render(<SearchDashboard />);

    expect(screen.getByRole("form", { name: "Fixture search" })).toBeInTheDocument();
    expect(screen.getByLabelText("Postcode")).toHaveValue("SE20 7RS");
    expect(screen.getByRole("button", { name: "Locate me" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "This weekend" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next weekend" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All upcoming" })).toBeInTheDocument();
  });

  it("shows the empty state when the search API returns no fixtures", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    render(<SearchDashboard />);

    expect(await screen.findByText("No fixtures found for the selected dates.")).toBeInTheDocument();
    expect(screen.getByText("0 fixtures", { selector: "strong" })).toBeInTheDocument();
  });

  it("reveals the next page of fixtures from the Show more control", async () => {
    const user = userEvent.setup();
    const fixtures = Array.from({ length: 13 }, (_, index) => fixture(index + 1));
    fetchMock.mockResolvedValueOnce(jsonResponse(fixtures));

    render(<SearchDashboard />);

    expect(await screen.findByText("Team 12 v Opponent 12")).toBeInTheDocument();
    expect(screen.queryByText("Team 13 v Opponent 13")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show more fixtures" }));

    expect(screen.getByText("Team 13 v Opponent 13")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Show more fixtures" })).not.toBeInTheDocument();
    });
  });
});

function jsonResponse(results: FixtureResult[]): Response {
  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function fixture(id: number): FixtureResult {
  return {
    id,
    title: `Team ${id} v Opponent ${id}`,
    competitionCode: "TEST",
    competitionName: "Test League",
    kickoffAt: `2026-06-${String(id).padStart(2, "0")}T15:00:00.000Z`,
    fixtureDate: `2026-06-${String(id).padStart(2, "0")}`,
    kickoffTime: "15:00",
    kickoffTimeStatus: "confirmed",
    seasonLabel: "2025-26",
    venueName: `Ground ${id}`,
    venuePostcode: "SE20 7RS",
    homeClub: `Team ${id}`,
    awayClub: `Opponent ${id}`,
    homeOneOff: false,
    awayOneOff: false,
    officialSiteUrl: null,
    genericTicketUrl: null,
    price: {
      saleMode: "pay_on_gate",
      adultPricePence: 1200,
      concessionPricePence: 600,
      sourceUrl: null,
      verifiedAt: null,
      confidence: "verified",
      isOverride: false,
      overrideNote: null
    },
    travel: {
      distanceMiles: id,
      drivingMinutes: 20 + id,
      publicTransportMinutes: 30 + id,
      publicTransportUrl: null,
      source: "cache"
    },
    isDemoData: false,
    isHistorical: false,
    warnings: []
  };
}
