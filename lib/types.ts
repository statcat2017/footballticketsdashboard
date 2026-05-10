export type CompetitionCode = "PL" | "ELC";

export interface SearchRequest {
  postcode: string;
  radiusMiles: number;
  dateFrom: string;
  dateTo: string;
}

export interface PriceSummary {
  label: string;
  amountPence: number | null;
  sourceUrl: string | null;
  verifiedAt: string | null;
  confidence: "verified" | "seed" | "unknown";
}

export interface TravelSummary {
  distanceMiles: number;
  drivingMinutes: number | null;
  publicTransportMinutes: number | null;
  source: "cache" | "distance_only";
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
