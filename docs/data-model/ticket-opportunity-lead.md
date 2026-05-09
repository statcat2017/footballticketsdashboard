# Ticket Opportunity Lead Data Model

Status: DBA-approved for implementation planning.

This model is the canonical target for public ticket opportunity ingestion. It represents fixtures, prices, sale states, concessions, and purchase/info links from public sources without claiming protected live inventory.

## Core Principles

- Sale state is lead state, not live seat inventory.
- Unknown values stay nullable or explicitly `unknown`.
- Static policy can enrich a fixture, but cannot prove a fixture is on sale.
- Every emitted value must carry enough provenance to audit where it came from.
- Venue/postcode conflicts must block or downgrade distance ranking until resolved.

## Type Sketch

```ts
type EvidenceKind =
  | "unknown"
  | "explicit"
  | "inferred"
  | "manual"
  | "static_policy"
  | "event_page"
  | "live_observed";

type SourceConfidence = "high" | "medium" | "low";
type SourcePriority = "primary" | "enrichment" | "fallback" | "manual_seed";

type SaleState =
  | "available_lead"
  | "pay_on_gate"
  | "not_on_sale_yet"
  | "off_sale"
  | "sold_out"
  | "no_public_sale"
  | "cancelled_or_postponed"
  | "unknown";

type PriceBasis =
  | "fixture_event_page"
  | "official_current_price_page"
  | "official_news_post"
  | "trusted_opponent_guide"
  | "manual_seed"
  | "unknown";

interface TicketOpportunityLead {
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
```

## Supporting Types

```ts
interface SourceProvenance {
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

interface SaleInfo {
  state: SaleState;
  stateBasis: EvidenceKind;
  stateText: string | null;
  onSaleAt: string | null;
  offSaleAt: string | null;
  observedAt: string;
  freshnessUntil: string | null;
}

interface PriceBand {
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

interface ConcessionRule {
  label: string;
  minAge: number | null;
  maxAge: number | null;
  qualifyingGroups: string[];
  requiresId: boolean | null;
  appliesToPriceBandIds: string[];
  evidenceKind: EvidenceKind;
  sourceUrl: string;
}

interface EligibilityRule {
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

interface VenueRef {
  name: string | null;
  address: string | null;
  postcode: string | null;
  postcodeStatus: "verified" | "source_provided" | "registry_seed" | "conflict" | "unknown";
  latitude: number | null;
  longitude: number | null;
  sourceUrl: string | null;
}
```

## Evidence And Unknown Rules

- Use `null` for missing scalar values and `unknown` enum values only when the source was checked but did not provide a usable value.
- Do not invent kickoff times, prices, postcodes, off-sale times, sale availability, or concession thresholds.
- `explicit` means visible source text directly states the value.
- `inferred` is allowed only for weak lead signals such as a visible ticket CTA; it should carry low confidence.
- `static_policy` can enrich price and concession rules, but cannot prove a specific fixture is on sale.
- `manual` and `manual_seed` values must remain auditable and lower confidence unless refreshed.
- `event_page` values are fixture-specific and usually outrank static policy.
- `live_observed` is reserved for permitted public event-page observations, not protected inventory.

## Sale-State Rules

`available_lead` means a public buy/info route exists or explicit public text says tickets are available. It does not mean seats remain.

Do not ingest or infer:

- inventory counts
- seat-map state
- basket state
- checkout availability
- account-only exchange availability

`sold_out` is allowed only when source text explicitly says sold out. Missing products, missing links, no-products pages, unavailable pages, or off-sale messages must not be converted into sold out unless the source says so.

## Price Precedence

Use this precedence when multiple prices describe the same fixture and audience:

1. Fixture/event page.
2. Official current price page.
3. Official fixture/news post.
4. Trusted opponent guide.
5. Manual seed.

Higher precedence values can determine the effective displayed price. Lower precedence values should be retained where useful, with provenance. Cup, all-ticket, segregated, or special-event pricing overrides static admission policy for that fixture only.

## Freshness Rules

- Event pages and sale states should expire quickly, normally within 2-6 hours before kickoff.
- Static admission policies can be cached longer, but must include season/current-page validation.
- Manual seeds must be lead-only and stale unless explicitly refreshed.
- Stale leads may be shown with reduced confidence, but should not rank as strongly as fresh official leads.

## Venue And Postcode Rules

- Fixture source venue text wins over club default for neutral and away fixtures.
- Approved venue registry data wins over informal snippets for coordinates.
- If plausible postcodes conflict, set `postcodeStatus: "conflict"`, emit a warning, and disable or downgrade distance ranking for that lead.
- Never silently choose between conflicts such as `SK14 5PL` vs `SK14 2SB` or `MK44 3LW` vs `MK44 3SB`.

## Dulwich Hamlet Example

- Home fixtures normalize to `Champion Hill Stadium`, `SE22 8BD`.
- Men's static prices:
  - adult `1300`
  - concession `550`
  - U13 `0`, conditional on paying adult
- Women's static prices:
  - adult `500`
  - concession `250`
  - U13 `0`, conditional on paying adult
- Fanbase enrichment is medium confidence.
- Official fixture and static price pages are high confidence.
- Inferred link-based sale states are low confidence.
