import { seedTickets } from "@/data/seed-tickets";
import { distanceMiles } from "@/lib/distance";
import { venueLocations } from "@/lib/fixtures";
import { normalizePostcode, postcodeSeedCoordinate } from "@/lib/postcode";
import type { RankedTicketResult, TicketResult, UserSearch } from "@/lib/types";

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
