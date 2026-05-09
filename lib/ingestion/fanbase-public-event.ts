import {
  createAdapterResult,
  createBlockedAdapterResult,
  createParserFailureResult
} from "@/lib/ingestion/adapter-contract";
import { evaluateSourceCompliance } from "@/lib/ingestion/compliance";
import { htmlToText, slugify } from "@/lib/ingestion/html";
import type {
  TicketSourceAdapter,
  TicketSourceAdapterContext,
  TicketSourceAdapterResult
} from "@/lib/ingestion/adapter-contract";
import type { PriceBand, TicketOpportunityLead } from "@/lib/ingestion/ticket-opportunity";

export const fanbasePublicEventAdapter: TicketSourceAdapter = {
  id: "fanbasePublicEventAdapter",
  displayName: "Fanbase public event",
  sourceKind: "official_platform",
  parserVersion: "1.0.0",
  async run() {
    return createAdapterResult(this, [], [
      {
        severity: "info",
        code: "no_events",
        message: "Fanbase adapter requires explicitly supplied official event URLs."
      }
    ]);
  }
};

export interface FanbaseEventParseOptions {
  sourceUrl: string;
  observedAt: string;
  clubName: string;
}

function statusFromText(text: string): TicketOpportunityLead["sale"]["state"] {
  if (/sold\s*out/i.test(text)) {
    return "sold_out";
  }

  if (/off\s*sale|sale\s+closed|no longer available/i.test(text)) {
    return "off_sale";
  }

  if (/not\s+on\s+sale|on\s+sale\s+from/i.test(text)) {
    return "not_on_sale_yet";
  }

  if (/ticket|buy|book|available/i.test(text)) {
    return "available_lead";
  }

  return "unknown";
}

function parsePriceBands(text: string, sourceUrl: string, observedAt: string): PriceBand[] {
  const bands: PriceBand[] = [];
  const pricePattern = /([A-Z][A-Za-z0-9 +/'-]{2,40})\s+(?:from\s+)?£\s*(\d+(?:\.\d{1,2})?)/gi;
  let match: RegExpExecArray | null;

  while ((match = pricePattern.exec(text)) !== null) {
    const label = match[1].trim();
    bands.push({
      id: slugify(label),
      label,
      audience: /child|u13|under/i.test(label) ? "child" : /senior/i.test(label) ? "senior" : /concession/i.test(label) ? "concession" : "adult",
      currency: "GBP",
      amountPence: Math.round(Number.parseFloat(match[2]) * 100),
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
    });
  }

  return bands;
}

export function parseFanbasePublicEventHtml(
  html: string,
  options: FanbaseEventParseOptions
): TicketOpportunityLead {
  const text = htmlToText(html);
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    text.split("\n").find((line) => line.trim().length > 4) ??
    "Fanbase ticket event";
  const cleanTitle = htmlToText(title);
  const observedAt = options.observedAt;

  return {
    id: `fanbase-${slugify(cleanTitle)}`,
    fixtureStableKey: `fanbase:${slugify(cleanTitle)}`,
    adapterId: fanbasePublicEventAdapter.id,
    parserVersion: fanbasePublicEventAdapter.parserVersion,
    observedAt,
    fetchedAt: observedAt,
    freshnessUntil: null,
    staleAfter: null,
    source: {
      sourceUrl: options.sourceUrl,
      sourceKind: "official_platform",
      sourcePriority: "enrichment",
      finalUrl: options.sourceUrl,
      httpStatus: 200,
      fetchStatus: "success",
      confidence: "medium",
      evidenceKind: "event_page",
      complianceNotes: ["Public Fanbase page only; no basket, checkout, account, or inventory probing."]
    },
    club: {
      name: options.clubName,
      team: "unknown"
    },
    fixture: {
      homeTeam: null,
      awayTeam: null,
      opponent: cleanTitle,
      competition: null,
      kickoffAt: null,
      kickoffTimezone: "Europe/London",
      homeAway: "unknown",
      status: "unknown"
    },
    venue: {
      name: null,
      address: null,
      postcode: null,
      postcodeStatus: "unknown",
      latitude: null,
      longitude: null,
      sourceUrl: options.sourceUrl
    },
    purchaseUrl: options.sourceUrl,
    infoUrl: options.sourceUrl,
    sale: {
      state: statusFromText(text),
      stateBasis: /sold\s*out|off\s*sale|not\s+on\s+sale|available/i.test(text) ? "explicit" : "unknown",
      stateText: text.match(/(sold\s*out|off\s*sale|not\s+on\s+sale[^.]*|tickets?[^.]*available[^.]*)/i)?.[0] ?? null,
      onSaleAt: null,
      offSaleAt: null,
      observedAt,
      freshnessUntil: null
    },
    priceBands: parsePriceBands(text, options.sourceUrl, observedAt),
    concessions: [],
    eligibility: [],
    dataQuality: {
      confidence: "medium",
      completeness: "lead_only",
      warnings: []
    }
  };
}

export async function runFanbasePublicEventUrl(
  sourceUrl: string,
  context: TicketSourceAdapterContext,
  clubName: string
): Promise<TicketSourceAdapterResult> {
  const compliance = evaluateSourceCompliance(sourceUrl);

  if (!compliance.allowed) {
    return createBlockedAdapterResult(fanbasePublicEventAdapter, compliance, context.now.toISOString());
  }

  try {
    const response = await context.fetch(sourceUrl, { signal: context.signal });
    const html = await response.text();

    if (response.status === 401 || response.status === 403 || response.status === 429 || /login|captcha|queue/i.test(html)) {
      return createBlockedAdapterResult(
        fanbasePublicEventAdapter,
        {
          allowed: false,
          code: "blocked",
          message: "Fanbase page requires login, queue, CAPTCHA, or blocked access.",
          sourceUrl
        },
        context.now.toISOString()
      );
    }

    return createAdapterResult(
      fanbasePublicEventAdapter,
      [parseFanbasePublicEventHtml(html, { sourceUrl, observedAt: context.now.toISOString(), clubName })],
      [],
      context.now.toISOString()
    );
  } catch (error) {
    return createParserFailureResult(fanbasePublicEventAdapter, sourceUrl, error, context.now.toISOString());
  }
}
