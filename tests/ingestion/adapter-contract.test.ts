import { describe, expect, it } from "vitest";

import {
  createAdapterContext,
  createAdapterResult,
  createBlockedAdapterResult,
  createEmptyAdapterResult,
  createParserFailureResult,
  createTicketSourceRegistry,
  evaluateSourceCompliance
} from "@/lib/ingestion";
import type { TicketOpportunityLead, TicketSourceAdapter } from "@/lib/ingestion";

const adapter: TicketSourceAdapter = {
  id: "fake-club",
  displayName: "Fake Club",
  sourceKind: "official_club",
  parserVersion: "1.0.0",
  async run() {
    return createAdapterResult(this, [leadFixture()]);
  }
};

function leadFixture(overrides: Partial<TicketOpportunityLead> = {}): TicketOpportunityLead {
  const observedAt = "2026-05-09T10:00:00.000Z";
  const sourceUrl = "https://example.com/tickets";

  return {
    id: "fake-club-home-2026-05-16",
    fixtureStableKey: "fake-club:home:2026-05-16",
    adapterId: adapter.id,
    parserVersion: adapter.parserVersion,
    observedAt,
    fetchedAt: observedAt,
    freshnessUntil: "2026-05-09T16:00:00.000Z",
    staleAfter: "2026-05-09T16:00:00.000Z",
    source: {
      sourceUrl,
      sourceKind: "official_club",
      sourcePriority: "primary",
      finalUrl: sourceUrl,
      httpStatus: 200,
      fetchStatus: "success",
      confidence: "high",
      evidenceKind: "explicit",
      complianceNotes: []
    },
    club: {
      name: "Fake Club",
      team: "men",
      competitionLevel: "Step 3"
    },
    fixture: {
      homeTeam: "Fake Club",
      awayTeam: "Visitors FC",
      opponent: "Visitors FC",
      competition: "League",
      kickoffAt: "2026-05-16T15:00:00.000+01:00",
      kickoffTimezone: "Europe/London",
      homeAway: "home",
      status: "scheduled"
    },
    venue: {
      name: "Fake Ground",
      address: "1 High Street",
      postcode: "AB1 2CD",
      postcodeStatus: "source_provided",
      latitude: null,
      longitude: null,
      sourceUrl
    },
    purchaseUrl: sourceUrl,
    infoUrl: sourceUrl,
    sale: {
      state: "available_lead",
      stateBasis: "explicit",
      stateText: "Tickets are available online.",
      onSaleAt: null,
      offSaleAt: null,
      observedAt,
      freshnessUntil: "2026-05-09T16:00:00.000Z"
    },
    priceBands: [
      {
        id: "adult",
        label: "Adult",
        audience: "adult",
        currency: "GBP",
        amountPence: 1200,
        minAmountPence: null,
        maxAmountPence: null,
        feePence: null,
        channel: "online",
        basis: "fixture_event_page",
        evidenceKind: "explicit",
        appliesTo: "fixture",
        conditional: false,
        sourceUrl,
        observedAt,
        precedenceRank: 1
      }
    ],
    concessions: [],
    eligibility: [
      {
        type: "general_sale",
        label: "General sale",
        appliesToPriceBandIds: ["adult"],
        required: false,
        evidenceKind: "explicit",
        sourceUrl
      }
    ],
    dataQuality: {
      confidence: "high",
      completeness: "partial",
      warnings: []
    },
    ...overrides
  };
}

describe("ticket source adapter contract", () => {
  it("returns successful opportunity leads with required provenance", async () => {
    const result = await adapter.run(createAdapterContext({ now: new Date("2026-05-09T10:00:00.000Z") }));

    expect(result.adapterId).toBe(adapter.id);
    expect(result.parserVersion).toBe(adapter.parserVersion);
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].source.sourceUrl).toBe("https://example.com/tickets");
    expect(result.leads[0].source.fetchStatus).toBe("success");
    expect(result.diagnostics).toHaveLength(0);
  });

  it("distinguishes an empty source from a failed source", () => {
    const result = createEmptyAdapterResult(adapter, "https://example.com/tickets");

    expect(result.leads).toHaveLength(0);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "info",
        code: "no_events",
        sourceUrl: "https://example.com/tickets"
      })
    );
  });

  it("returns blocked diagnostics without placeholder leads", () => {
    const decision = evaluateSourceCompliance("https://example.com/account/tickets");
    const result = createBlockedAdapterResult(adapter, decision);

    expect(result.leads).toHaveLength(0);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "blocked",
        fetchStatus: "blocked"
      })
    );
  });

  it("wraps parser failures into diagnostics", () => {
    const result = createParserFailureResult(
      adapter,
      "https://example.com/tickets",
      new Error("Missing fixture title")
    );

    expect(result.leads).toHaveLength(0);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "parser_failed",
        message: "Missing fixture title"
      })
    );
  });

  it("flags leads missing adapter provenance", () => {
    const result = createAdapterResult(adapter, [
      leadFixture({ adapterId: "wrong-adapter" })
    ]);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "invalid_lead"
      })
    );
  });

  it("registers adapters and rejects duplicate ids", () => {
    const registry = createTicketSourceRegistry([adapter]);

    expect(registry.get(adapter.id)).toBe(adapter);
    expect(() => registry.register(adapter)).toThrow("Ticket source adapter already registered");
  });
});
