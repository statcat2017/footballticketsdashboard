export type CompetitionCode = "PL" | "ELC";

export interface SearchRequest {
  postcode: string;
  radiusMiles?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface PriceSummary {
  saleMode: "all_ticket" | "pay_on_gate" | null;
  adultPricePence: number | null;
  concessionPricePence: number | null;
  sourceUrl: string | null;
  verifiedAt: string | null;
  confidence: "verified" | "seed" | "unknown";
  isOverride: boolean;
}

export interface TravelSummary {
  distanceMiles: number;
  drivingMinutes: number | null;
  publicTransportMinutes: number | null;
  publicTransportUrl: string | null;
  source: "cache" | "live" | "distance_only";
}

export interface FixtureResult {
  id: number;
  title: string;
  competitionCode: CompetitionCode;
  competitionName: string;
  kickoffAt: string | null;
  venueName: string;
  venuePostcode: string;
  homeClub: string;
  awayClub: string;
  officialSiteUrl: string | null;
  genericTicketUrl: string | null;
  price: PriceSummary;
  travel: TravelSummary;
  isDemoData: boolean;
  isHistorical: boolean;
  warnings: string[];
}

export interface CorrectionInput {
  fixtureId?: number;
  clubName?: string;
  email?: string;
  priceText: string;
  sourceUrl?: string;
  message?: string;
}
