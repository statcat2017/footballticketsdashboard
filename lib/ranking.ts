import { seedTickets } from "@/data/seed-tickets";
import { distanceMiles } from "@/lib/distance";
import { venueLocations } from "@/lib/fixtures";
import type { PriceBand, TicketOpportunityLead } from "@/lib/ingestion/ticket-opportunity";
import { normalizePostcode, postcodeSeedCoordinate } from "@/lib/postcode";
import type { RankedTicketOpportunityResult, RankedTicketResult, TicketResult, UserSearch } from "@/lib/types";

function isAgeEligible(ticket: TicketResult, age: number): boolean {
  if (!ticket.ageRule) {
    return true;
  }

  if (ticket.ageRule.minAge !== undefined && age < ticket.ageRule.minAge) {
    return false;
  }

  if (ticket.ageRule.maxAge !== undefined && age > ticket.ageRule.maxAge) {
    return false;
  }

  return true;
}

export function getEffectivePricePence(ticket: TicketResult, age: number): number {
  if (
    ticket.concessionPricePence !== undefined &&
    ticket.ageRule?.concessionAge !== undefined &&
    age >= ticket.ageRule.concessionAge
  ) {
    return ticket.concessionPricePence;
  }

  if (
    ticket.concessionPricePence !== undefined &&
    ticket.ageRule?.maxAge !== undefined &&
    age <= ticket.ageRule.maxAge
  ) {
    return ticket.concessionPricePence;
  }

  return ticket.pricePence;
}

function rankingReasons(ticket: TicketResult, effectivePricePence: number, distance: number): string[] {
  const reasons = [`${distance.toFixed(1)} miles away`];

  if (ticket.sourceKind === "official") {
    reasons.push("official source");
  }

  if (effectivePricePence < ticket.pricePence) {
    reasons.push("concession price applied");
  }

  if (ticket.availability === "available") {
    reasons.push("tickets available");
  }

  return reasons;
}

function scoreTicket(ticket: TicketResult, effectivePricePence: number, distance: number): number {
  const sourceScore = ticket.sourceKind === "official" ? 20 : 8;
  const availabilityScore = ticket.availability === "available" ? 24 : ticket.availability === "limited" ? 12 : -50;
  const distanceScore = Math.max(0, 35 - distance * 0.35);
  const priceScore = Math.max(0, 30 - effectivePricePence / 400);

  return Math.round((sourceScore + availabilityScore + distanceScore + priceScore) * 10) / 10;
}

export function rankTickets(search: UserSearch, tickets: TicketResult[] = seedTickets): RankedTicketResult[] {
  const normalizedPostcode = normalizePostcode(search.postcode);
  const userLocation = postcodeSeedCoordinate(normalizedPostcode);

  return tickets
    .filter((ticket) => ticket.availability !== "sold-out")
    .filter((ticket) => isAgeEligible(ticket, search.age))
    .map((ticket) => {
      const venueLocation = venueLocations[ticket.venuePostcode];
      const distance = venueLocation ? distanceMiles(userLocation, venueLocation) : 999;
      const effectivePricePence = getEffectivePricePence(ticket, search.age);
      const score = scoreTicket(ticket, effectivePricePence, distance);

      return {
        ...ticket,
        distanceMiles: Math.round(distance * 10) / 10,
        effectivePricePence,
        score,
        rankingReasons: rankingReasons(ticket, effectivePricePence, distance)
      };
    })
    .sort((first, second) => second.score - first.score);
}

function saleLabel(state: TicketOpportunityLead["sale"]["state"]): string {
  const labels: Record<TicketOpportunityLead["sale"]["state"], string> = {
    available_lead: "Ticket lead",
    pay_on_gate: "Pay on gate",
    not_on_sale_yet: "Not on sale yet",
    off_sale: "Off sale",
    sold_out: "Sold out",
    no_public_sale: "No public sale",
    cancelled_or_postponed: "Cancelled or postponed",
    unknown: "Sale state unknown"
  };

  return labels[state];
}

function saleScore(state: TicketOpportunityLead["sale"]["state"]): number {
  const scores: Record<TicketOpportunityLead["sale"]["state"], number> = {
    pay_on_gate: 26,
    available_lead: 22,
    not_on_sale_yet: 12,
    unknown: 5,
    off_sale: -12,
    no_public_sale: -18,
    sold_out: -30,
    cancelled_or_postponed: -100
  };

  return scores[state];
}

function isAgeMatch(band: PriceBand, age: number): boolean {
  if (band.audience === "senior") {
    return age >= 65;
  }

  if (band.audience === "child") {
    return age <= 12;
  }

  if (band.audience === "youth") {
    return age >= 13 && age <= 19;
  }

  return band.audience === "adult" || band.audience === "concession";
}

function chooseDisplayPrice(lead: TicketOpportunityLead, age: number): PriceBand | null {
  const pricedBands = lead.priceBands.filter((band) => band.amountPence !== null);

  if (pricedBands.length === 0) {
    return null;
  }

  return [...pricedBands].sort((first, second) => {
    const precedence = first.precedenceRank - second.precedenceRank;

    if (precedence !== 0) {
      return precedence;
    }

    const ageMatch = Number(isAgeMatch(second, age)) - Number(isAgeMatch(first, age));

    if (ageMatch !== 0) {
      return ageMatch;
    }

    if (first.audience === "adult" && second.audience !== "adult") {
      return -1;
    }

    if (second.audience === "adult" && first.audience !== "adult") {
      return 1;
    }

    return (first.amountPence ?? 0) - (second.amountPence ?? 0);
  })[0];
}

function opportunityTitle(lead: TicketOpportunityLead): string {
  if (lead.fixture.homeTeam && lead.fixture.awayTeam) {
    return `${lead.fixture.homeTeam} vs ${lead.fixture.awayTeam}`;
  }

  if (lead.fixture.opponent) {
    return `${lead.club.name} vs ${lead.fixture.opponent}`;
  }

  return lead.club.name;
}

export function rankTicketOpportunityLeads(
  search: UserSearch,
  leads: TicketOpportunityLead[]
): RankedTicketOpportunityResult[] {
  const normalizedPostcode = normalizePostcode(search.postcode);
  const userLocation = postcodeSeedCoordinate(normalizedPostcode);

  return leads
    .filter((lead) => lead.fixture.status !== "cancelled")
    .filter((lead) => lead.sale.state !== "cancelled_or_postponed")
    .map((lead) => {
      const venueLocation =
        lead.venue.latitude !== null && lead.venue.longitude !== null
          ? { latitude: lead.venue.latitude, longitude: lead.venue.longitude }
          : lead.venue.postcode
            ? venueLocations[lead.venue.postcode]
            : undefined;
      const distance =
        venueLocation && lead.venue.postcodeStatus !== "conflict" && lead.venue.postcodeStatus !== "unknown"
          ? Math.round(distanceMiles(userLocation, venueLocation) * 10) / 10
          : null;
      const displayPrice = chooseDisplayPrice(lead, search.age);
      const confidencePenalty = lead.dataQuality.confidence === "low" ? -12 : lead.dataQuality.confidence === "medium" ? -4 : 0;
      const distanceScore = distance === null ? -8 : Math.max(0, 35 - distance * 0.35);
      const priceScore = displayPrice === null ? -3 : Math.max(0, 25 - (displayPrice.amountPence ?? 0) / 350);
      const score = Math.round((saleScore(lead.sale.state) + distanceScore + priceScore + confidencePenalty) * 10) / 10;
      const rankingReasons = [
        distance === null ? "distance unavailable" : `${distance.toFixed(1)} miles away`,
        lead.source.sourceKind === "official_club" || lead.source.sourceKind === "official_platform" ? "official source" : null,
        lead.sale.state === "pay_on_gate" ? "pay on gate" : "ticket lead",
        displayPrice ? `${displayPrice.label} price` : "price unavailable",
        lead.dataQuality.confidence === "low" ? "low confidence" : null
      ].filter((reason): reason is string => reason !== null);

      return {
        id: lead.id,
        fixtureStableKey: lead.fixtureStableKey,
        title: opportunityTitle(lead),
        competition: lead.fixture.competition,
        venueName: lead.venue.name,
        kickoffAt: lead.fixture.kickoffAt,
        distanceMiles: distance,
        displayPricePence: displayPrice?.amountPence ?? null,
        displayPriceLabel: displayPrice?.label ?? "Price TBC",
        saleState: lead.sale.state,
        saleLabel: saleLabel(lead.sale.state),
        sourceLabel: lead.source.sourceKind.replace(/_/g, " "),
        confidence: lead.dataQuality.confidence,
        purchaseUrl: lead.purchaseUrl,
        infoUrl: lead.infoUrl,
        score,
        rankingReasons,
        warnings: [...lead.dataQuality.warnings, ...lead.source.complianceNotes]
      };
    })
    .sort((first, second) => second.score - first.score);
}
