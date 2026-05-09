import { describe, expect, it } from "vitest";

import { getEffectivePricePence, rankTickets } from "@/lib/ranking";
import type { TicketResult } from "@/lib/types";

const baseTicket: TicketResult = {
  id: "ticket",
  homeTeam: "Home",
  awayTeam: "Away",
  competition: "League",
  venue: "Old Trafford",
  venuePostcode: "M16 0RA",
  kickoff: "2026-08-15T15:00:00.000Z",
  sourceName: "Official",
  sourceKind: "official",
  pricePence: 5000,
  currency: "GBP",
  availability: "available",
  url: "https://example.com"
};

describe("getEffectivePricePence", () => {
  it("uses senior concession price when user is above concession age", () => {
    expect(
      getEffectivePricePence(
        { ...baseTicket, concessionPricePence: 3000, ageRule: { concessionAge: 65 } },
        70
      )
    ).toBe(3000);
  });

  it("uses standard price when concession does not apply", () => {
    expect(
      getEffectivePricePence(
        { ...baseTicket, concessionPricePence: 3000, ageRule: { concessionAge: 65 } },
        40
      )
    ).toBe(5000);
  });
});

describe("rankTickets", () => {
  it("filters tickets with incompatible maximum age", () => {
    const results = rankTickets(
      { postcode: "M16 0RA", age: 65 },
      [{ ...baseTicket, ageRule: { maxAge: 17 } }]
    );

    expect(results).toHaveLength(0);
  });

  it("prioritizes nearby available official tickets", () => {
    const results = rankTickets(
      { postcode: "M16 0RA", age: 40 },
      [
        { ...baseTicket, id: "near", venuePostcode: "M16 0RA", sourceKind: "official" },
        { ...baseTicket, id: "far", venuePostcode: "N5 1BU", sourceKind: "trusted-resale" }
      ]
    );

    expect(results[0].id).toBe("near");
    expect(results[0].rankingReasons).toContain("official source");
  });
});
