import {
  createAdapterResult,
  createBlockedAdapterResult,
  createEmptyAdapterResult,
  createParserFailureResult
} from "@/lib/ingestion/adapter-contract";
import { evaluateSourceCompliance } from "@/lib/ingestion/compliance";
import { extractLinks, htmlToText, slugify } from "@/lib/ingestion/html";
import type {
  TicketSourceAdapter,
  TicketSourceAdapterContext,
  TicketSourceAdapterResult
} from "@/lib/ingestion/adapter-contract";
import type { PriceBand, SaleState, TicketOpportunityLead } from "@/lib/ingestion/ticket-opportunity";

export const ktcktsPublicEventAdapter: TicketSourceAdapter = {
  id: "ktcktsPublicEventAdapter",
  displayName: "Ktckts/Kaizen public event",
  sourceKind: "official_platform",
  parserVersion: "1.0.0",
  async run() {
    return createAdapterResult(this, [], [
      {
        severity: "info",
        code: "no_events",
        message: "Ktckts adapter requires explicitly supplied public brand or event URLs."
      }
    ]);
  }
};

export interface KtcktsClubMapping {
  clubName: string;
  team?: "men" | "women" | "mixed" | "unknown";
  competitionLevel?: string;
  defaultVenueName?: string | null;
  defaultVenuePostcode?: string | null;
  defaultLatitude?: number | null;
  defaultLongitude?: number | null;
}

export interface KtcktsDiscoveredEvent {
  title: string;
  url: string;
  fromPricePence: number | null;
  saleState: SaleState;
  sourceText: string | null;
}

function amountToPence(value: string | number): number {
  return Math.round(Number(value) * 100);
}

function saleStateFromText(text: string): SaleState {
  if (/sold\s*out/i.test(text)) return "sold_out";
  if (/not\s+on\s+sale/i.test(text)) return "not_on_sale_yet";
  if (/limited supporters|currently unavailable|no products on sale|unavailable|discontinued/i.test(text)) return "no_public_sale";
  if (/from\s+£|buy|tickets?|available/i.test(text)) return "available_lead";
  return "unknown";
}

function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch {
      // Ignore malformed public metadata and fall back to visible HTML.
    }
  }

  return blocks;
}

function extractProductCode(sourceUrl: string): string | null {
  return new URL(sourceUrl).pathname.match(/\/event\/([^/]+)/i)?.[1] ?? null;
}

export function parseKtcktsBrandHtml(html: string, sourceUrl: string): KtcktsDiscoveredEvent[] {
  const text = htmlToText(html);

  if (/there are currently no products on sale/i.test(text)) {
    return [];
  }

  const itemLists = jsonLdBlocks(html).flatMap((block): Array<{ name?: string; url?: string }> => {
    const maybeList = block as { "@type"?: string; itemListElement?: Array<{ name?: string; url?: string; item?: { name?: string; url?: string } }> };

    if (maybeList["@type"] !== "ItemList" || !Array.isArray(maybeList.itemListElement)) {
      return [];
    }

    return maybeList.itemListElement.map((item) => ({ name: item.name ?? item.item?.name, url: item.url ?? item.item?.url }));
  });

  if (itemLists.length > 0) {
    return itemLists
      .filter((item): item is { name: string; url: string } => Boolean(item.name && item.url))
      .map((item) => ({
        title: item.name,
        url: new URL(item.url, sourceUrl).toString(),
        fromPricePence: null,
        saleState: "unknown",
        sourceText: null
      }));
  }

  return extractLinks(html, sourceUrl)
    .filter((link) => /\/event\//i.test(link.href))
    .map((link) => {
      const fromPrice = text.match(/from\s+£\s*(\d+(?:\.\d{1,2})?)/i)?.[1] ?? null;

      return {
        title: link.text || link.href,
        url: link.href,
        fromPricePence: fromPrice ? amountToPence(fromPrice) : null,
        saleState: saleStateFromText(text),
        sourceText: text
      };
    });
}

function priceBandFromEvent(label: string, amountPence: number, sourceUrl: string, observedAt: string): PriceBand {
  return {
    id: slugify(label),
    label,
    audience: /child|u1\d|junior/i.test(label) ? "child" : /senior|concession/i.test(label) ? "concession" : "adult",
    currency: "GBP",
    amountPence,
    minAmountPence: null,
    maxAmountPence: null,
    feePence: null,
    channel: "online",
    basis: "fixture_event_page",
    evidenceKind: "event_page",
    appliesTo: "fixture",
    conditional: false,
    sourceUrl,
    observedAt,
    precedenceRank: 1
  };
}

export function parseKtcktsEventHtml(
  html: string,
  sourceUrl: string,
  observedAt: string,
  mapping: KtcktsClubMapping
): TicketOpportunityLead {
  const text = htmlToText(html);
  const eventBlock = jsonLdBlocks(html).find((block) => (block as { "@type"?: string })["@type"] === "Event") as
    | {
        name?: string;
        eventStatus?: string;
        location?: { name?: string };
        offers?: { url?: string; availability?: string; price?: string | number; priceCurrency?: string };
        performer?: { name?: string };
      }
    | undefined;
  const headingTitle = htmlToText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const title = eventBlock?.name ?? (headingTitle || "Ktckts event");
  const productCode = extractProductCode(sourceUrl);
  const priceBands: PriceBand[] = [];

  if (eventBlock?.offers?.price !== undefined) {
    priceBands.push(priceBandFromEvent("Event from price", amountToPence(eventBlock.offers.price), sourceUrl, observedAt));
  }

  for (const match of text.matchAll(/([A-Z][A-Za-z0-9 +/'-]{2,40})\s+£\s*(\d+(?:\.\d{1,2})?)/g)) {
    priceBands.push(priceBandFromEvent(match[1].trim(), amountToPence(match[2]), sourceUrl, observedAt));
  }

  const availabilityText = `${eventBlock?.offers?.availability ?? ""} ${eventBlock?.eventStatus ?? ""} ${text}`;
  const saleState = saleStateFromText(availabilityText);

  return {
    id: `ktckts:${productCode ?? slugify(title)}`,
    fixtureStableKey: `ktckts:${productCode ?? slugify(title)}`,
    adapterId: ktcktsPublicEventAdapter.id,
    parserVersion: ktcktsPublicEventAdapter.parserVersion,
    observedAt,
    fetchedAt: observedAt,
    freshnessUntil: null,
    staleAfter: null,
    source: {
      sourceUrl,
      sourceKind: "official_platform",
      sourcePriority: "primary",
      finalUrl: eventBlock?.offers?.url ?? sourceUrl,
      httpStatus: 200,
      fetchStatus: "success",
      confidence: "medium",
      evidenceKind: "event_page",
      complianceNotes: ["Ktckts public HTML/JSON-LD only; no API, cart, checkout, login, or quantity flow accessed."]
    },
    club: { name: mapping.clubName, team: mapping.team ?? "unknown", competitionLevel: mapping.competitionLevel },
    fixture: {
      homeTeam: title.toLowerCase().startsWith(mapping.clubName.toLowerCase()) ? mapping.clubName : null,
      awayTeam: null,
      opponent: title,
      competition: eventBlock?.performer?.name ?? null,
      kickoffAt: null,
      kickoffTimezone: "Europe/London",
      homeAway: "home",
      status: "scheduled"
    },
    venue: {
      name: eventBlock?.location?.name ?? mapping.defaultVenueName ?? null,
      address: null,
      postcode: mapping.defaultVenuePostcode ?? null,
      postcodeStatus: mapping.defaultVenuePostcode ? "registry_seed" : "unknown",
      latitude: mapping.defaultLatitude ?? null,
      longitude: mapping.defaultLongitude ?? null,
      sourceUrl
    },
    purchaseUrl: sourceUrl,
    infoUrl: sourceUrl,
    sale: {
      state: saleState,
      stateBasis: saleState === "unknown" ? "unknown" : "explicit",
      stateText: text.match(/(not\s+on\s+sale|sold\s+out|currently unavailable|limited supporters|no products on sale)[^.\n]*/i)?.[0] ?? null,
      onSaleAt: null,
      offSaleAt: null,
      observedAt,
      freshnessUntil: null
    },
    priceBands,
    concessions: [],
    eligibility: /limited supporters|log in/i.test(text)
      ? [{
          type: "membership",
          label: "Public page says availability may be limited to supporters or login-required.",
          appliesToPriceBandIds: priceBands.map((band) => band.id),
          required: true,
          evidenceKind: "explicit",
          sourceUrl
        }]
      : [],
    dataQuality: {
      confidence: "medium",
      completeness: priceBands.length > 0 ? "partial" : "lead_only",
      warnings: saleState === "no_public_sale" ? ["Ktckts page is unavailable, restricted, or has no public products; not treated as sold out."] : []
    }
  };
}

export async function runKtcktsPublicUrl(
  context: TicketSourceAdapterContext,
  sourceUrl: string,
  mapping: KtcktsClubMapping
): Promise<TicketSourceAdapterResult> {
  const observedAt = context.now.toISOString();
  const compliance = evaluateSourceCompliance(sourceUrl);

  if (!compliance.allowed) {
    return createBlockedAdapterResult(ktcktsPublicEventAdapter, compliance, observedAt);
  }

  try {
    const response = await context.fetch(sourceUrl, { signal: context.signal });
    const html = await response.text();

    if (/\/brand\//i.test(new URL(sourceUrl).pathname)) {
      const discovered = parseKtcktsBrandHtml(html, sourceUrl);

      if (discovered.length === 0) {
        return createEmptyAdapterResult(ktcktsPublicEventAdapter, sourceUrl, "Ktckts brand page has no public products on sale.", observedAt);
      }

      return createAdapterResult(
        ktcktsPublicEventAdapter,
        discovered.map((event) => parseKtcktsEventHtml(`<h1>${event.title}</h1><p>${event.sourceText ?? ""}</p>`, event.url, observedAt, mapping)),
        [],
        observedAt
      );
    }

    return createAdapterResult(ktcktsPublicEventAdapter, [parseKtcktsEventHtml(html, sourceUrl, observedAt, mapping)], [], observedAt);
  } catch (error) {
    return createParserFailureResult(ktcktsPublicEventAdapter, sourceUrl, error, observedAt);
  }
}
