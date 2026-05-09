export type TicketSourceKind = "official" | "trusted-resale" | "seed";

export interface UserSearch {
  postcode: string;
  age: number;
}

export interface AgeRule {
  minAge?: number;
  maxAge?: number;
  concessionAge?: number;
}

export interface TicketResult {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  venue: string;
  venuePostcode: string;
  kickoff: string;
  sourceName: string;
  sourceKind: TicketSourceKind;
  pricePence: number;
  concessionPricePence?: number;
  currency: "GBP";
  availability: "available" | "limited" | "sold-out";
  url: string;
  ageRule?: AgeRule;
}

export interface RankedTicketResult extends TicketResult {
  effectivePricePence: number;
  distanceMiles: number;
  score: number;
  rankingReasons: string[];
}

export interface VenueLocation {
  postcode: string;
  latitude: number;
  longitude: number;
}
