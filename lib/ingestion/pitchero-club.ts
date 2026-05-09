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
import type { PriceBand, TicketOpportunityLead } from "@/lib/ingestion/ticket-opportunity";

export const pitcheroClubAdapter: TicketSourceAdapter = {
  id: "pitcheroClubAdapter",
  displayName: "Pitchero club public pages",
  sourceKind: "official_platform",
  parserVersion: "1.0.0",
  async run() {
    return createAdapterResult(this, [], [
      {
        severity: "info",
        code: "no_events",
        message: "Pitchero adapter requires a club fixture URL and optional admission page URL."
      }
    ]);
  }
};

export interface PitcheroClubMapping {
  clubName: string;
  team?: "men" | "women" | "mixed" | "unknown";
  competitionLevel?: string;
  defaultVenueName?: string | null;
  defaultVenuePostcode?: string | null;
  defaultLatitude?: number | null;
  defaultLongitude?: number | null;
}

export interface PitcheroFixtureParseOptions {
  sourceUrl: string;
  observedAt: string;
  mapping: PitcheroClubMapping;
  priceBands?: PriceBand[];
}

function amountToPence(value: string): number {
  return Math.round(Number.parseFloat(value) * 100);
}

function titleFromCard(cardText: string, clubName: string): string {
  const lines = cardText.split("\n").map((line) => line.trim()).filter(Boolean);

  return (
    lines.find((line) => / v | vs | at /i.test(line)) ??
    lines.find((line) => line.length > 4 && !/tickets?|fixtures?|match centre/i.test(line)) ??
    clubName
  );
}

function opponentFromTitle(title: string, clubName: string): string | null {
  const escapedClub = clubName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`${escapedClub}\\s+(?:v|vs)\\s+(.+)`, "i"),
    new RegExp(`(.+)\\s+(?:v|vs)\\s+${escapedClub}`, "i")
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return title === clubName ? null : title;
}

function statusFromText(text: string, purchaseUrl: string | null): TicketOpportunityLead["sale"]["state"] {
  if (/sold\s*out/i.test(text)) return "sold_out";
  if (/off\s*sale|no\s+longer\s+available/i.test(text)) return "off_sale";
  if (/not\s+on\s+sale|on\s+sale\s+from/i.test(text)) return "not_on_sale_yet";
  if (/pay\s+on\s+(?:the\s+)?gate|turnstile/i.test(text)) return "pay_on_gate";
  if (purchaseUrl || /tickets?\s+available|buy\s+tickets?/i.test(text)) return "available_lead";
  return "unknown";
}

function extractFixtureCards(html: string): string[] {
  const candidates = html.match(/<(?:article|li|div)\b[^>]*(?:fixture|match|event|card)[^>]*>[\s\S]*?<\/(?:article|li|div)>/gi) ?? [];
  return candidates.filter((candidate) => /fixture|match|v | vs |ticket|venue|kick/i.test(htmlToText(candidate)));
}

export function parsePitcheroAdmissionHtml(
  html: string,
  sourceUrl: string,
  observedAt: string
): { priceBands: PriceBand[]; warnings: string[] } {
  const text = htmlToText(html);
  const warnings: string[] = [];
  const priceBands: PriceBand[] = [];
  const pricePattern = /(adult|concession|senior|student|youth|under\s*\d+|u\d+|child)[^£\n]{0,40}£\s*(\d+(?:\.\d{1,2})?)/gi;
  let match: RegExpExecArray | null;

  while ((match = pricePattern.exec(text)) !== null) {
    const label = match[1].replace(/\s+/g, " ").trim();
    const normalized = label.toLowerCase();
    priceBands.push({
      id: slugify(label),
      label,
      audience: /senior/.test(normalized) ? "senior" : /student|concession/.test(normalized) ? "concession" : /youth|under|u\d+|child/.test(normalized) ? "youth" : "adult",
      currency: "GBP",
      amountPence: amountToPence(match[2]),
      minAmountPence: null,
      maxAmountPence: null,
      feePence: null,
      channel: /online/i.test(text) ? "online" : "gate",
      basis: "official_current_price_page",
      evidenceKind: "static_policy",
      appliesTo: "club_policy",
      conditional: /free with|accompanied/i.test(text) && /under|u\d+|child/i.test(label),
      sourceUrl,
      observedAt,
      precedenceRank: 2
    });
  }

  if (priceBands.length === 0) {
    warnings.push("No labelled admission prices found on Pitchero admission page.");
  }

  return { priceBands, warnings };
}

export function parsePitcheroFixtureHtml(
  html: string,
  options: PitcheroFixtureParseOptions
): TicketOpportunityLead[] {
  const pageText = htmlToText(html);

  if (/no fixtures|no matches|no events/i.test(pageText)) {
    return [];
  }

  return extractFixtureCards(html).map((cardHtml) => {
    const cardText = htmlToText(cardHtml);
    const title = titleFromCard(cardText, options.mapping.clubName);
    const opponent = opponentFromTitle(title, options.mapping.clubName);
    const ticketLink = extractLinks(cardHtml, options.sourceUrl).find((link) => /ticket|buy|match centre|preview/i.test(`${link.text} ${link.href}`));
    const purchaseUrl = ticketLink?.href ?? null;
    const stableKey = `pitchero:${slugify(options.mapping.clubName)}:${slugify(title)}`;
    const state = statusFromText(cardText, purchaseUrl);
    const homeTitle = title.toLowerCase().startsWith(options.mapping.clubName.toLowerCase());

    return {
      id: stableKey,
      fixtureStableKey: stableKey,
      adapterId: pitcheroClubAdapter.id,
      parserVersion: pitcheroClubAdapter.parserVersion,
      observedAt: options.observedAt,
      fetchedAt: options.observedAt,
      freshnessUntil: null,
      staleAfter: null,
      source: {
        sourceUrl: options.sourceUrl,
        sourceKind: "official_platform",
        sourcePriority: "primary",
        finalUrl: options.sourceUrl,
        httpStatus: 200,
        fetchStatus: "success",
        confidence: "medium",
        evidenceKind: purchaseUrl ? "inferred" : "explicit",
        complianceNotes: ["Pitchero public page only; no login, admin, basket, or checkout areas accessed."]
      },
      club: {
        name: options.mapping.clubName,
        team: options.mapping.team ?? "unknown",
        competitionLevel: options.mapping.competitionLevel
      },
      fixture: {
        homeTeam: homeTitle ? options.mapping.clubName : null,
        awayTeam: homeTitle ? opponent : null,
        opponent,
        competition: cardText.match(/(?:competition|league|cup):?\s*([^\n]+)/i)?.[1]?.trim() ?? null,
        kickoffAt: null,
        kickoffTimezone: "Europe/London",
        homeAway: / away/i.test(cardText) ? "away" : / home/i.test(cardText) || options.mapping.defaultVenueName ? "home" : "unknown",
        status: "scheduled"
      },
      venue: {
        name: cardText.match(/(?:venue|ground):?\s*([^\n]+)/i)?.[1]?.trim() ?? options.mapping.defaultVenueName ?? null,
        address: null,
        postcode: options.mapping.defaultVenuePostcode ?? null,
        postcodeStatus: options.mapping.defaultVenuePostcode ? "registry_seed" : "unknown",
        latitude: options.mapping.defaultLatitude ?? null,
        longitude: options.mapping.defaultLongitude ?? null,
        sourceUrl: options.sourceUrl
      },
      purchaseUrl,
      infoUrl: purchaseUrl ?? options.sourceUrl,
      sale: {
        state,
        stateBasis: /sold|off sale|not on sale|pay on|turnstile/i.test(cardText) ? "explicit" : purchaseUrl ? "inferred" : "unknown",
        stateText: cardText.match(/(sold\s*out|off\s*sale|not\s+on\s+sale[^.\n]*|pay\s+on[^.\n]*|tickets?[^.\n]*available[^.\n]*)/i)?.[0] ?? null,
        onSaleAt: null,
        offSaleAt: null,
        observedAt: options.observedAt,
        freshnessUntil: null
      },
      priceBands: options.priceBands ?? [],
      concessions: [],
      eligibility: [],
      dataQuality: { confidence: "medium", completeness: "lead_only", warnings: [] }
    };
  });
}

export function applyPitcheroMatchCentreOverride(
  lead: TicketOpportunityLead,
  matchCentreHtml: string,
  sourceUrl: string,
  observedAt: string
): TicketOpportunityLead {
  const text = htmlToText(matchCentreHtml);
  const state = statusFromText(text, lead.purchaseUrl);
  const admission = parsePitcheroAdmissionHtml(matchCentreHtml, sourceUrl, observedAt);

  return {
    ...lead,
    sale: state === "unknown" ? lead.sale : {
      ...lead.sale,
      state,
      stateBasis: /sold|off sale|not on sale|pay on|turnstile/i.test(text) ? "explicit" : lead.sale.stateBasis,
      stateText: text.match(/(sold\s*out|off\s*sale|not\s+on\s+sale[^.\n]*|pay\s+on[^.\n]*|tickets?[^.\n]*available[^.\n]*)/i)?.[0] ?? lead.sale.stateText,
      observedAt
    },
    priceBands: admission.priceBands.length > 0 ? admission.priceBands.map((band) => ({
      ...band,
      basis: "official_news_post",
      evidenceKind: "event_page",
      appliesTo: "fixture",
      precedenceRank: 1
    })) : lead.priceBands,
    source: { ...lead.source, finalUrl: sourceUrl }
  };
}

export async function runPitcheroClubPages(
  context: TicketSourceAdapterContext,
  mapping: PitcheroClubMapping,
  fixtureUrl: string,
  admissionUrl?: string
): Promise<TicketSourceAdapterResult> {
  const observedAt = context.now.toISOString();
  const fixtureCompliance = evaluateSourceCompliance(fixtureUrl);

  if (!fixtureCompliance.allowed) {
    return createBlockedAdapterResult(pitcheroClubAdapter, fixtureCompliance, observedAt);
  }

  try {
    let priceBands: PriceBand[] = [];

    if (admissionUrl) {
      const admissionCompliance = evaluateSourceCompliance(admissionUrl);

      if (admissionCompliance.allowed) {
        const admissionResponse = await context.fetch(admissionUrl, { signal: context.signal });
        priceBands = parsePitcheroAdmissionHtml(await admissionResponse.text(), admissionUrl, observedAt).priceBands;
      }
    }

    const fixtureResponse = await context.fetch(fixtureUrl, { signal: context.signal });
    const leads = parsePitcheroFixtureHtml(await fixtureResponse.text(), { sourceUrl: fixtureUrl, observedAt, mapping, priceBands });

    if (leads.length === 0) {
      return createEmptyAdapterResult(pitcheroClubAdapter, fixtureUrl, "Pitchero fixture page reported no fixtures.", observedAt);
    }

    return createAdapterResult(pitcheroClubAdapter, leads, [], observedAt);
  } catch (error) {
    return createParserFailureResult(pitcheroClubAdapter, fixtureUrl, error, observedAt);
  }
}
