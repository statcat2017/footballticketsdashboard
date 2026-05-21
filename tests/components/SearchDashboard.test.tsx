import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchDashboard } from "@/app/components/SearchDashboard";
import type { FixtureResult } from "@/lib/types";

const fetchMock = vi.fn<typeof fetch>();
let originalGeolocation: Geolocation | undefined;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn() }
  });
});

beforeAll(() => {
  originalGeolocation = navigator.geolocation;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

afterAll(() => {
  if (originalGeolocation !== undefined) {
    Object.defineProperty(navigator, "geolocation", { value: originalGeolocation, writable: true, configurable: true });
  }
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
    expect(screen.getByRole("button", { name: "All dates" })).toBeInTheDocument();
  });

  it("shows the empty state when the search API returns no fixtures", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    render(<SearchDashboard />);

    expect(await screen.findByText("No fixtures found for the selected filters.")).toBeInTheDocument();
    expect(screen.getByText("0 fixtures", { selector: "strong" })).toBeInTheDocument();
  });

  it("reveals the next page of fixtures from the Show more control", async () => {
    const user = userEvent.setup();
    const fixtures = Array.from({ length: 13 }, (_, index) => fixture(index + 1));
    fetchMock.mockResolvedValueOnce(jsonResponse(fixtures));

    render(<SearchDashboard />);

    const showMoreButtons = await screen.findAllByRole("button", { name: /Show .+ more of .+ fixtures/ });
    expect(showMoreButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Team 12 v Opponent 12").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Team 13 v Opponent 13")).not.toBeInTheDocument();

    await user.click(showMoreButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByText("Team 13 v Opponent 13").length).toBeGreaterThanOrEqual(1);
    });
    const buttonsAfter = screen.queryAllByRole("button", { name: /Show .+ more of .+ fixtures/ });
    expect(buttonsAfter.length).toBe(0);
  });

  it("groups fixtures by date with chronological order", async () => {
    const fixtures = [
      customFixture(1, { title: "Match A", fixtureDate: "2026-06-01", kickoffAt: "2026-06-01T15:00:00.000Z", travel: { distanceMiles: 5, drivingMinutes: 30, publicTransportMinutes: 40, source: "cache", publicTransportUrl: null } }),
      customFixture(2, { title: "Match B", fixtureDate: "2026-06-02", kickoffAt: "2026-06-02T15:00:00.000Z", travel: { distanceMiles: 2, drivingMinutes: 15, publicTransportMinutes: 25, source: "cache", publicTransportUrl: null } }),
      customFixture(3, { title: "Match C", fixtureDate: "2026-06-01", kickoffAt: "2026-06-01T12:00:00.000Z", travel: { distanceMiles: 1, drivingMinutes: 10, publicTransportMinutes: 20, source: "cache", publicTransportUrl: null } }),
    ];
    fetchMock.mockResolvedValueOnce(jsonResponse(fixtures));

    render(<SearchDashboard />);

    const headers = await screen.findAllByText(/Monday 1 June|Tuesday 2 June/);
    expect(headers.length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Match A").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Match B").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Match C").length).toBeGreaterThanOrEqual(1);
  });

  it("shows disabled featured CTA when no ticket URL is available", async () => {
    const fixtures = [
      customFixture(1, { officialSiteUrl: null, genericTicketUrl: null })
    ];
    fetchMock.mockResolvedValueOnce(jsonResponse(fixtures));

    render(<SearchDashboard />);

    const disabled = await screen.findByText("Details unavailable");
    expect(disabled).toBeInTheDocument();
  });

  it("resets visibleCount when sort key changes", async () => {
    const user = userEvent.setup();
    const fixtures = Array.from({ length: 20 }, (_, i) => customFixture(i + 1, {
      travel: { distanceMiles: i + 1, drivingMinutes: 20 + i, publicTransportMinutes: 30 + i, source: "cache", publicTransportUrl: null }
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse(fixtures));

    render(<SearchDashboard />);

    const showMore = await screen.findAllByText(/Show 8 more of 20 fixtures/);
    expect(showMore.length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getAllByRole("button", { name: /Show .+ more of .+ fixtures/ })[0]);

    await waitFor(() => {
      expect(screen.queryAllByText(/Show .+ more of .+ fixtures/).length).toBe(0);
    });

    const sortSelect = screen.getByRole("combobox", { name: "Sort fixtures" });
    await user.selectOptions(sortSelect, "kickoff");

    await waitFor(() => {
      expect(screen.getAllByText(/Show 8 more of 20 fixtures/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows competition badges for different competition types", async () => {
    const fixtures = [
      customFixture(1, { competitionName: "Premier League", competitionCode: "PL" }),
      customFixture(2, { competitionName: "EFL Championship", competitionCode: "EFLC" }),
      customFixture(3, { competitionName: "Non-League Friendlies", competitionCode: "NLF" }),
    ];
    fetchMock.mockResolvedValueOnce(jsonResponse(fixtures));

    render(<SearchDashboard />);

    const pl = await screen.findAllByText("Premier League");
    expect(pl.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("EFL").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Non-league").length).toBeGreaterThanOrEqual(1);
  });

  it("filters by competition category", async () => {
    const user = userEvent.setup();
    const fixtures = [
      customFixture(1, { competitionName: "Premier League", competitionCode: "PL" }),
      customFixture(2, { competitionName: "Non-League Friendlies", competitionCode: "NLF" }),
    ];
    fetchMock.mockResolvedValueOnce(jsonResponse(fixtures));

    render(<SearchDashboard />);

    expect((await screen.findAllByText("Team 1 v Opponent 1")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Team 2 v Opponent 2").length).toBeGreaterThanOrEqual(1);

    const compSelect = screen.getByRole("combobox", { name: "Competition filter" });
    await user.selectOptions(compSelect, "premier-league");

    await waitFor(() => {
      expect(screen.queryAllByText("Team 2 v Opponent 2").length).toBe(0);
    });
  });

  it("shows trust line when verifiedAt is present", async () => {
    const fixtures = [
      customFixture(1, { price: { saleMode: null, adultPricePence: null, concessionPricePence: null, sourceUrl: "https://club.example.com", verifiedAt: new Date().toISOString(), confidence: "verified", isOverride: false, overrideNote: null } }),
    ];
    fetchMock.mockResolvedValueOnce(jsonResponse(fixtures));

    render(<SearchDashboard />);

    const checked = await screen.findAllByText(/Checked/);
    expect(checked.length).toBeGreaterThanOrEqual(1);
  });
});

function jsonResponse(results: FixtureResult[]): Response {
  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function customFixture(id: number, overrides: Partial<FixtureResult> & { travel?: Partial<FixtureResult["travel"]>; price?: Partial<FixtureResult["price"]> }): FixtureResult {
  const base = fixture(id);
  return {
    ...base,
    ...overrides,
    travel: { ...base.travel, ...overrides.travel },
    price: { ...base.price, ...overrides.price }
  } as FixtureResult;
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
