import { extractLinks, htmlToText } from "@/lib/ingestion/html";
import type { ConcessionRule, EligibilityRule, PriceBand } from "@/lib/ingestion/ticket-opportunity";

export interface StaticAdmissionPolicy {
  sourceUrl: string;
  observedAt: string;
  seasonLabel: string | null;
  priceBands: PriceBand[];
  concessions: ConcessionRule[];
  eligibility: EligibilityRule[];
  purchaseUrls: string[];
  warnings: string[];
}

interface StaticAdmissionOptions {
  sourceUrl: string;
  observedAt: string;
}

function amountToPence(value: string): number {
  return Math.round(Number.parseFloat(value) * 100);
}

function priceBand(
  id: string,
  label: string,
  audience: PriceBand["audience"],
  amountPence: number,
  sourceUrl: string,
  observedAt: string
): PriceBand {
  return {
    id,
    label,
    audience,
    currency: "GBP",
    amountPence,
    minAmountPence: null,
    maxAmountPence: null,
    feePence: null,
    channel: "gate",
    basis: "official_current_price_page",
    evidenceKind: "static_policy",
    appliesTo: "team_policy",
    conditional: audience === "child",
    sourceUrl,
    observedAt,
    precedenceRank: 2
  };
}

function concession(
  label: string,
  sourceUrl: string,
  overrides: Partial<ConcessionRule> = {}
): ConcessionRule {
  return {
    label,
    minAge: null,
    maxAge: null,
    qualifyingGroups: [],
    requiresId: true,
    appliesToPriceBandIds: ["men-concession", "women-concession"],
    evidenceKind: "static_policy",
    sourceUrl,
    ...overrides
  };
}

export function parseStaticAdmissionPolicy(html: string, options: StaticAdmissionOptions): StaticAdmissionPolicy {
  const text = htmlToText(html);
  const lowerText = text.toLowerCase();
  const priceBands: PriceBand[] = [];
  const warnings: string[] = [];
  const seasonLabel = text.match(/\b20\d{2}\s*[-/]\s*\d{2}\b/)?.[0] ?? null;

  const menSection = text.match(/Men['’]s Games([\s\S]*?)(Women['’]s Tickets|Concessions|Main Stand|$)/i)?.[1] ?? text;
  const womenSection = text.match(/Women['’]s Tickets([\s\S]*?)(Concessions|Main Stand|$)/i)?.[1] ?? "";

  const menAmounts = [...menSection.matchAll(/£\s*(\d+(?:\.\d{1,2})?)/g)].map((match) => match[1]);
  const womenAmounts = [...womenSection.matchAll(/£\s*(\d+(?:\.\d{1,2})?)/g)].map((match) => match[1]);
  const menAdult = menSection.match(/£\s*(\d+(?:\.\d{1,2})?)\s+for\s+Adults/i)?.[1] ?? menAmounts[0];
  const menConcession = menSection.match(/£\s*(\d+(?:\.\d{1,2})?)\s+for\s+Concessions/i)?.[1] ?? menAmounts[1];
  const womenAdult = womenSection.match(/£\s*(\d+(?:\.\d{1,2})?)\s+for\s+Adults/i)?.[1] ?? womenAmounts[0];
  const womenConcession = womenSection.match(/£\s*(\d+(?:\.\d{1,2})?)\s+for\s+Concessions/i)?.[1] ?? womenAmounts[1];

  if (menAdult) {
    priceBands.push(priceBand("men-adult", "Men's adult", "adult", amountToPence(menAdult), options.sourceUrl, options.observedAt));
  }

  if (menConcession) {
    priceBands.push(priceBand("men-concession", "Men's concession", "concession", amountToPence(menConcession), options.sourceUrl, options.observedAt));
  }

  if (/under\s+13s?\s+free/i.test(menSection)) {
    priceBands.push(priceBand("men-u13", "Men's under 13 with paying adult", "child", 0, options.sourceUrl, options.observedAt));
  }

  if (womenAdult) {
    priceBands.push(priceBand("women-adult", "Women's adult", "adult", amountToPence(womenAdult), options.sourceUrl, options.observedAt));
  }

  if (womenConcession) {
    priceBands.push(priceBand("women-concession", "Women's concession", "concession", amountToPence(womenConcession), options.sourceUrl, options.observedAt));
  }

  if (/under\s+13s?\s+free/i.test(womenSection)) {
    priceBands.push(priceBand("women-u13", "Women's under 13 with paying adult", "child", 0, options.sourceUrl, options.observedAt));
  }

  if (priceBands.length === 0) {
    warnings.push("No labelled GBP admission prices found.");
  }

  const concessions: ConcessionRule[] = [];

  if (/65\+/.test(text) || /seniors/i.test(text)) {
    concessions.push(concession("Senior 65+", options.sourceUrl, { minAge: 65, qualifyingGroups: ["senior"] }));
  }

  if (/teenagers?\s*\(13\s*[-–]\s*19\)/i.test(text)) {
    concessions.push(concession("Teenager 13-19", options.sourceUrl, { minAge: 13, maxAge: 19, qualifyingGroups: ["teenager"] }));
  }

  if (/under\s+13s?\s+free/i.test(text)) {
    concessions.push(concession("Under 13 with paying adult", options.sourceUrl, {
      maxAge: 12,
      requiresId: false,
      qualifyingGroups: ["child"],
      appliesToPriceBandIds: ["men-u13", "women-u13"]
    }));
  }

  const groupLabels = [
    ["unemployed", /unemployed|jsa/i],
    ["NHS staff", /nhs/i],
    ["blue light services", /blue light/i],
    ["armed forces", /armed forces/i],
    ["local authority workers", /local authority/i],
    ["full time students", /full[ -]time students?/i]
  ] as const;

  const qualifyingGroups = groupLabels.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);

  if (qualifyingGroups.length > 0) {
    concessions.push(concession("Concession qualifying groups", options.sourceUrl, { qualifyingGroups }));
  }

  const eligibility: EligibilityRule[] = [];

  if (/turnstiles? on matchdays?|buy your ticket on the turnstiles/i.test(text)) {
    eligibility.push({
      type: "general_sale",
      label: "Pay on the turnstiles on matchdays",
      appliesToPriceBandIds: priceBands.map((band) => band.id),
      required: false,
      evidenceKind: "static_policy",
      sourceUrl: options.sourceUrl
    });
  }

  if (/valid id/i.test(lowerText)) {
    eligibility.push({
      type: "id_required",
      label: "Valid ID required for concessions",
      appliesToPriceBandIds: ["men-concession", "women-concession"],
      required: true,
      evidenceKind: "static_policy",
      sourceUrl: options.sourceUrl
    });
  }

  if (/under\s+13s?\s+free\s+accompanied by a paying adult/i.test(text)) {
    eligibility.push({
      type: "must_be_with_adult",
      label: "Under 13 free only when accompanied by a paying adult",
      appliesToPriceBandIds: ["men-u13", "women-u13"],
      required: true,
      evidenceKind: "static_policy",
      sourceUrl: options.sourceUrl
    });
  }

  const purchaseUrls = extractLinks(html, options.sourceUrl)
    .filter((link) => /fanbase|ticket/i.test(`${link.href} ${link.text}`))
    .map((link) => link.href);

  return {
    sourceUrl: options.sourceUrl,
    observedAt: options.observedAt,
    seasonLabel,
    priceBands,
    concessions,
    eligibility,
    purchaseUrls: [...new Set(purchaseUrls)],
    warnings
  };
}
