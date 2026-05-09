export type EvidenceKind =
  | "unknown"
  | "explicit"
  | "inferred"
  | "manual"
  | "static_policy"
  | "event_page"
  | "live_observed";

export type SourceConfidence = "high" | "medium" | "low";
export type SourcePriority = "primary" | "enrichment" | "fallback" | "manual_seed";

export type SaleState =
  | "available_lead"
  | "pay_on_gate"
  | "not_on_sale_yet"
  | "off_sale"
  | "sold_out"
  | "no_public_sale"
  | "cancelled_or_postponed"
  | "unknown";

export type PriceBasis =
  | "fixture_event_page"
  | "official_current_price_page"
  | "official_news_post"
  | "trusted_opponent_guide"
  | "manual_seed"
  | "unknown";

export interface SourceProvenance {
  sourceUrl: string;
  sourceKind:
    | "official_club"
    | "official_platform"
    | "trusted_platform"
    | "trusted_guide"
    | "manual_seed";
  sourcePriority: SourcePriority;
  finalUrl: string | null;
  httpStatus: number | null;
  fetchStatus:
    | "success"
    | "empty_success"
    | "not_modified"
    | "failed"
    | "blocked"
    | "robots_disallowed";
  confidence: SourceConfidence;
  evidenceKind: EvidenceKind;
  complianceNotes: string[];
}

export interface SaleInfo {
  state: SaleState;
  stateBasis: EvidenceKind;
  stateText: string | null;
  onSaleAt: string | null;
  offSaleAt: string | null;
  observedAt: string;
  freshnessUntil: string | null;
}

export interface PriceBand {
  id: string;
  label: string;
  audience:
    | "adult"
    | "concession"
    | "senior"
    | "student"
    | "youth"
    | "child"
    | "disabled"
    | "carer"
    | "other";
  currency: "GBP";
  amountPence: number | null;
  minAmountPence: number | null;
  maxAmountPence: number | null;
  feePence: number | null;
  channel: "online" | "gate" | "phone" | "unknown";
  basis: PriceBasis;
  evidenceKind: EvidenceKind;
  appliesTo: "fixture" | "team_policy" | "club_policy" | "unknown";
  conditional: boolean;
  sourceUrl: string;
  observedAt: string;
  precedenceRank: number;
}

export interface ConcessionRule {
  label: string;
  minAge: number | null;
  maxAge: number | null;
  qualifyingGroups: string[];
  requiresId: boolean | null;
  appliesToPriceBandIds: string[];
  evidenceKind: EvidenceKind;
  sourceUrl: string;
}

export interface EligibilityRule {
  type:
    | "general_sale"
    | "membership"
    | "season_ticket_holder"
    | "age"
    | "id_required"
    | "must_be_with_adult"
    | "no_gate_sales"
    | "all_ticket"
    | "unknown";
  label: string;
  appliesToPriceBandIds: string[];
  required: boolean;
  evidenceKind: EvidenceKind;
  sourceUrl: string;
}

export interface VenueRef {
  name: string | null;
  address: string | null;
  postcode: string | null;
  postcodeStatus: "verified" | "source_provided" | "registry_seed" | "conflict" | "unknown";
  latitude: number | null;
  longitude: number | null;
  sourceUrl: string | null;
}

export interface TicketOpportunityLead {
  id: string;
  fixtureStableKey: string;
  adapterId: string;
  parserVersion: string;
  observedAt: string;
  fetchedAt: string;
  freshnessUntil: string | null;
  staleAfter: string | null;
  source: SourceProvenance;
  club: {
    name: string;
    team: "men" | "women" | "mixed" | "unknown";
    competitionLevel?: string;
  };
  fixture: {
    homeTeam: string | null;
    awayTeam: string | null;
    opponent: string | null;
    competition: string | null;
    kickoffAt: string | null;
    kickoffTimezone: "Europe/London";
    homeAway: "home" | "away" | "neutral" | "unknown";
    status: "scheduled" | "postponed" | "cancelled" | "unknown";
  };
  venue: VenueRef;
  purchaseUrl: string | null;
  infoUrl: string;
  sale: SaleInfo;
  priceBands: PriceBand[];
  concessions: ConcessionRule[];
  eligibility: EligibilityRule[];
  dataQuality: {
    confidence: SourceConfidence;
    completeness: "complete" | "partial" | "lead_only";
    warnings: string[];
  };
}
