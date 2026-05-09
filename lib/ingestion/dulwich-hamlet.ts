import {
  createAdapterResult,
  createEmptyAdapterResult,
  createParserFailureResult
} from "@/lib/ingestion/adapter-contract";
import { absoluteUrl, extractLinks, htmlToText, slugify } from "@/lib/ingestion/html";
import { parseStaticAdmissionPolicy } from "@/lib/ingestion/static-admission";
import type {
  TicketSourceAdapter,
  TicketSourceAdapterContext,
  TicketSourceAdapterResult
} from "@/lib/ingestion/adapter-contract";
import type { PriceBand, TicketOpportunityLead } from "@/lib/ingestion/ticket-opportunity";

const CLUB_NAME = "Dulwich Hamlet FC";
const BASE_URL = "https://dulwichhamletfc.co.uk";
const TICKET_PRICES_URL = `${BASE_URL}/fixtures/ticket-prices`;
const MENS_FIXTURES_URL = `${BASE_URL}/fixtures/mens-fixtures-and-tickets?view=fixtures`;
const WOMENS_FIXTURES_URL = `${BASE_URL}/fixtures/womens-fixtures-and-tickets?view=fixtures`;

export const dulwichHamletOfficialOpportunityAdapter: TicketSourceAdapter = {
  id: "dulwichHamletOfficialOpportunityAdapter",
  displayName: "Dulwich Hamlet official opportunities",
  sourceKind: "official_club",
  parserVersion: "1.0.0",
  async run(context) {
    return runDulwichHamletOfficialOpportunityAdapter(context);
  }
};

interface FixtureParseOptions {
  sourceUrl: string;
  observedAt: string;
  team: "men" | "women";
  policyPriceBands: PriceBand[];
  purchaseUrl: string | null;
}

function teamPriceBands(policyPriceBands: PriceBand[], team: "men" | "women"): PriceBand[] {
  const prefix = team === "men" ? "men-" : "women-";
  return policyPriceBands.filter((band) => band.id.startsWith(prefix));
}

function statusFromCard(text: string, purchaseUrl: string | null): TicketOpportunityLead["sale"]["state"] {
  if (/sold\s*out/i.test(text)) {
    return "sold_out";
  }

  if (/off\s*sale|sale\s+closed/i.test(text)) {
    return "off_sale";
  }

  if (/not\s+on\s+sale|on\s+sale\s+from/i.test(text)) {
    return "not_on_sale_yet";
  }

  if (purchaseUrl) {
    return "available_lead";
  }

  return "pay_on_gate";
}

function leadFromFixtureCard(cardHtml: string, options: FixtureParseOptions): TicketOpportunityLead {
  const text = htmlToText(cardHtml);
  const opponent =
    cardHtml.match(/mdc-fixture-opponent[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ??
    text.match(/(?:vs?|v)\s+([A-Z][A-Za-z .'-]+)/)?.[1] ??
    "Opponent TBC";
  const cleanOpponent = htmlToText(opponent);
  const competition = htmlToText(cardHtml.match(/mdc-fixture-competition[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ?? "League fixture");
  const dateText = htmlToText(cardHtml.match(/mdc-fixture-date[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ?? "");
  const timeText = htmlToText(cardHtml.match(/mdc-fixture-time[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ?? "");
  const venueText = htmlToText(cardHtml.match(/mdc-fixture-venue[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ?? "");
  const ticketLink = extractLinks(cardHtml, options.sourceUrl).find((link) => /ticket|buy|book|fanbase/i.test(`${link.text} ${link.href}`));
  const purchaseUrl = ticketLink?.href ?? options.purchaseUrl;
  const homeFixture = /champion hill|dulwich hamlet|home/i.test(venueText) || !/away/i.test(text);
  const stableKey = `dulwich-hamlet:${options.team}:${slugify(cleanOpponent)}:${slugify(dateText || "date-tbc")}`;
  const saleState = statusFromCard(text, purchaseUrl);

  return {
    id: stableKey,
    fixtureStableKey: stableKey,
    adapterId: dulwichHamletOfficialOpportunityAdapter.id,
    parserVersion: dulwichHamletOfficialOpportunityAdapter.parserVersion,
    observedAt: options.observedAt,
    fetchedAt: options.observedAt,
    freshnessUntil: null,
    staleAfter: null,
    source: {
      sourceUrl: options.sourceUrl,
      sourceKind: "official_club",
      sourcePriority: "primary",
      finalUrl: options.sourceUrl,
      httpStatus: 200,
      fetchStatus: "success",
      confidence: "high",
      evidenceKind: purchaseUrl ? "inferred" : "static_policy",
      complianceNotes: ["Official public fixture page; no protected ticketing flow accessed."]
    },
    club: {
      name: CLUB_NAME,
      team: options.team,
      competitionLevel: options.team === "men" ? "Isthmian Premier" : "Women's National League"
    },
    fixture: {
      homeTeam: homeFixture ? CLUB_NAME : null,
      awayTeam: homeFixture ? cleanOpponent : CLUB_NAME,
      opponent: cleanOpponent,
      competition,
      kickoffAt: null,
      kickoffTimezone: "Europe/London",
      homeAway: homeFixture ? "home" : "away",
      status: "scheduled"
    },
    venue: {
      name: homeFixture ? "Champion Hill Stadium" : venueText || null,
      address: homeFixture ? "Edgar Kail Way, East Dulwich, London" : null,
      postcode: homeFixture ? "SE22 8BD" : null,
      postcodeStatus: homeFixture ? "verified" : "unknown",
      latitude: homeFixture ? 51.4615 : null,
      longitude: homeFixture ? -0.0802 : null,
      sourceUrl: options.sourceUrl
    },
    purchaseUrl,
    infoUrl: options.sourceUrl,
    sale: {
      state: saleState,
      stateBasis: purchaseUrl ? "inferred" : "static_policy",
      stateText: purchaseUrl ? "Official fixture page links to ticket information." : "Static admission policy says tickets can be bought on matchdays.",
      onSaleAt: null,
      offSaleAt: null,
      observedAt: options.observedAt,
      freshnessUntil: null
    },
    priceBands: teamPriceBands(options.policyPriceBands, options.team),
    concessions: [],
    eligibility: [],
    dataQuality: {
      confidence: purchaseUrl ? "medium" : "high",
      completeness: "partial",
      warnings: [dateText || timeText ? "" : "Kickoff date/time not parsed from fixture card."].filter(Boolean)
    }
  };
}

export function parseDulwichFixturePage(html: string, options: FixtureParseOptions): TicketOpportunityLead[] {
  if (/mdc-no-fixtures/i.test(html) && /no fixtures found/i.test(htmlToText(html))) {
    return [];
  }

  const cards = html.match(/<div class=["'][^"']*mdc-fixture-card[^"']*["'][\s\S]*?(?=<div class=["'][^"']*mdc-fixture-card|<\/div>\s*<\/div>\s*<\/div>\s*<\/section>|$)/gi) ?? [];

  return cards.map((card) => leadFromFixtureCard(card, options));
}

async function fetchHtml(context: TicketSourceAdapterContext, sourceUrl: string): Promise<string> {
  const response = await context.fetch(sourceUrl, {
    signal: context.signal,
    headers: { "User-Agent": "football-ticket-opportunity-dashboard/0.1" }
  });

  return response.text();
}

export async function runDulwichHamletOfficialOpportunityAdapter(
  context: TicketSourceAdapterContext
): Promise<TicketSourceAdapterResult> {
  const observedAt = context.now.toISOString();

  try {
    const priceHtml = await fetchHtml(context, TICKET_PRICES_URL);
    const policy = parseStaticAdmissionPolicy(priceHtml, { sourceUrl: TICKET_PRICES_URL, observedAt });
    const purchaseUrl = policy.purchaseUrls[0] ?? null;
    const [menHtml, womenHtml] = await Promise.all([
      fetchHtml(context, MENS_FIXTURES_URL),
      fetchHtml(context, WOMENS_FIXTURES_URL)
    ]);
    const leads = [
      ...parseDulwichFixturePage(menHtml, {
        sourceUrl: MENS_FIXTURES_URL,
        observedAt,
        team: "men",
        policyPriceBands: policy.priceBands,
        purchaseUrl
      }),
      ...parseDulwichFixturePage(womenHtml, {
        sourceUrl: WOMENS_FIXTURES_URL,
        observedAt,
        team: "women",
        policyPriceBands: policy.priceBands,
        purchaseUrl
      })
    ];

    for (const lead of leads) {
      lead.concessions = policy.concessions;
      lead.eligibility = policy.eligibility;
    }

    if (leads.length === 0) {
      return createEmptyAdapterResult(
        dulwichHamletOfficialOpportunityAdapter,
        `${MENS_FIXTURES_URL}, ${WOMENS_FIXTURES_URL}`,
        "Dulwich Hamlet official fixture pages currently report no fixtures found.",
        observedAt
      );
    }

    return createAdapterResult(
      dulwichHamletOfficialOpportunityAdapter,
      leads,
      policy.warnings.map((message) => ({ severity: "warning", code: "stale_source", message, sourceUrl: TICKET_PRICES_URL })),
      observedAt
    );
  } catch (error) {
    return createParserFailureResult(
      dulwichHamletOfficialOpportunityAdapter,
      TICKET_PRICES_URL,
      error,
      observedAt
    );
  }
}

export const dulwichSourceUrls = {
  ticketPrices: TICKET_PRICES_URL,
  mensFixtures: MENS_FIXTURES_URL,
  womensFixtures: WOMENS_FIXTURES_URL,
  fanbaseFixtures: absoluteUrl("https://app.fanbaseclub.com/Fan/Fixtures/Index?fanStoreType=Fixtures&clubId=123", BASE_URL)
};
