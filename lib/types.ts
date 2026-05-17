export type CompetitionCode = string;

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
  confidence: "verified" | "imported" | "inferred" | "approximate" | "unknown";
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
  competitionCode: string;
  competitionName: string;
  kickoffAt: string | null;
  fixtureDate: string | null;
  kickoffTime: string | null;
  kickoffTimeStatus: "confirmed" | "assumed" | "unknown" | null;
  seasonLabel: string | null;
  venueName: string;
  venuePostcode: string;
  homeClub: string;
  awayClub: string;
  homeOneOff: boolean;
  awayOneOff: boolean;
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
