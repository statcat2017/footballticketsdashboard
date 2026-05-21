import type { AppDatabase } from "../db/adapter.ts";

export type SourceType = "api_feed" | "agent_scrape" | "url_table_scrape" | "csv_upload" | "csv_paste" | "manual";
export type TrustLevel = "trusted" | "moderated" | "untrusted";
export type ParseStatus = "pending" | "parsing" | "parsed" | "failed";
export type ApprovalStatus = "pending" | "preview" | "approved" | "partially_approved" | "auto_approved" | "failed";
export type MatchResult = "insert" | "update" | "skip" | "blocked" | "pending" | "duplicate_existing_fixture" | "duplicate_pending_batch" | "duplicate_same_batch";
export type FinalAction = "insert" | "update" | "skip" | "blocked";
export type FixtureStatus = "scheduled" | "postponed" | "cancelled" | "finished" | "unknown";
export type Confidence = "verified" | "imported" | "inferred" | "approximate" | "unknown";

export interface KickoffAssumptionPolicy {
  enabled?: boolean;
  weekend?: string | null;
  midweek?: string | null;
}

export type IssueCode =
  | "unknown_competition"
  | "unknown_club"
  | "missing_primary_venue"
  | "missing_ticket_info"
  | "venue_not_found"
  | "ambiguous_club"
  | "invalid_date"
  | "invalid_time"
  | "assumed_time"
  | "invalid_status"
  | "invalid_source_url"
  | "invalid_ticket_url"
  | "venue_unusable_coords"
  | "one_off_needs_venue"
  | "missing_date"
  | "missing_participant"
  | "missing_competition"
  | "ambiguous_fixture_match"
  | "duplicate_existing_fixture"
  | "duplicate_pending_batch"
  | "duplicate_same_batch";

export interface WarningIssue {
  code: IssueCode;
  field?: string;
  rawValue?: string;
  severity: "blocker" | "warning";
  message: string;
  issueKey: string;
}

export interface WarningsPayload {
  issues: WarningIssue[];
  messages: string[];
}

export type RowActionType = "import_insert" | "import_update" | "skip" | "edit_row";

export interface RowEditFields {
  homeParticipantRaw?: string | null;
  awayParticipantRaw?: string | null;
  competitionRaw?: string | null;
  venueRaw?: string | null;
  kickoffDate?: string | null;
  kickoffTime?: string | null;
  status?: FixtureStatus | null;
  ticketUrl?: string | null;
  sourceUrl?: string | null;
}

export interface FixtureSource {
  id: number;
  sourceType: SourceType;
  name: string;
  baseUrl: string | null;
  trustLevel: TrustLevel;
  autoApproval: boolean;
  evidenceRequirements: string | null;
  lastSuccessAt: string | null;
  failureCount: number;
  createdAt: string;
}

export interface FixtureSourceInput {
  sourceType: SourceType;
  name: string;
  baseUrl?: string;
  trustLevel?: TrustLevel;
  autoApproval?: boolean;
  evidenceRequirements?: string;
}

export interface ImportBatch {
  id: number;
  sourceId: number;
  adapterType: SourceType;
  seasonLabel: string | null;
  actor: string;
  rawPayload: string | null;
  rawPayloadSizeBytes: number | null;
  parseStatus: ParseStatus;
  approvalStatus: ApprovalStatus;
  rowCountTotal: number;
  rowCountApproved: number;
  rowCountFailed: number;
  parseErrorsJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportBatchInput {
  sourceId: number;
  adapterType: SourceType;
  seasonLabel?: string;
  actor: string;
  rawPayload?: string;
}

export interface ImportBatchRow {
  id: number;
  batchId: number;
  rowIndex: number;
  homeParticipantRaw: string | null;
  awayParticipantRaw: string | null;
  homeParticipantResolvedId: number | null;
  awayParticipantResolvedId: number | null;
  homeIsOneOff: boolean;
  awayIsOneOff: boolean;
  competitionRaw: string | null;
  competitionResolvedCode: string | null;
  venueRaw: string | null;
  venueResolvedId: number | null;
  kickoffDate: string | null;
  kickoffTime: string | null;
  status: FixtureStatus | null;
  ticketUrl: string | null;
  adultPricePence: number | null;
  concessionPricePence: number | null;
  sourceUrl: string | null;
  evidenceJson: string | null;
  confidence: Confidence;
  matchResult: MatchResult | null;
  warningsJson: string | null;
  finalAction: FinalAction | null;
  finalFixtureId: number | null;
  createdAt: string;
}

export interface NormalizedFixtureRow {
  homeParticipantRaw: string;
  awayParticipantRaw: string;
  homeIsOneOff?: boolean;
  awayIsOneOff?: boolean;
  competitionRaw?: string;
  venueRaw?: string;
  kickoffDate?: string;
  kickoffTime?: string;
  status?: FixtureStatus;
  ticketUrl?: string;
  adultPricePence?: number;
  concessionPricePence?: number;
  sourceUrl?: string;
  evidence?: Record<string, unknown>;
  confidence?: Confidence;
}

export interface FixtureAdapterParseError {
  rowIndex: number;
  message: string;
}

export interface FixtureAdapterParseResult {
  rows: NormalizedFixtureRow[];
  errors: FixtureAdapterParseError[];
}

export interface FixtureSourceAdapter<
  ParseResult extends FixtureAdapterParseResult = FixtureAdapterParseResult,
  ImportResult = unknown,
  ParseOptions = undefined,
  CreateBatchArgs extends unknown[] = unknown[],
> {
  sourceType: SourceType;
  name: string;
  parse: (payload: string, options?: ParseOptions) => ParseResult | Promise<ParseResult>;
  createImportBatch?(db: AppDatabase, payload: string, ...args: CreateBatchArgs): Promise<ImportResult>;
}

export interface ImportBatchRowInput {
  rowIndex: number;
  row: NormalizedFixtureRow;
}

export interface BatchRowOutcomeUpdate {
  matchResult?: MatchResult;
  warnings?: unknown[] | Record<string, unknown> | null;
  finalAction?: FinalAction;
  finalFixtureId?: number | null;
  homeParticipantResolvedId?: number | null;
  awayParticipantResolvedId?: number | null;
  homeIsOneOff?: boolean;
  awayIsOneOff?: boolean;
  competitionResolvedCode?: string | null;
  venueResolvedId?: number | null;
  kickoffDate?: string | null;
  kickoffTime?: string | null;
  status?: FixtureStatus | null;
}
