export type SourceType = "api_feed" | "agent_scrape" | "url_table_scrape" | "csv_upload" | "csv_paste" | "manual";
export type TrustLevel = "trusted" | "moderated" | "untrusted";
export type ParseStatus = "pending" | "parsing" | "parsed" | "failed";
export type ApprovalStatus = "pending" | "preview" | "approved" | "partially_approved" | "auto_approved" | "failed";
export type MatchResult = "insert" | "update" | "skip" | "blocked" | "pending";
export type FinalAction = "insert" | "update" | "skip" | "blocked";
export type FixtureStatus = "scheduled" | "postponed" | "cancelled" | "finished" | "unknown";
export type Confidence = "verified" | "imported" | "inferred" | "approximate" | "unknown";

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
  competitionResolvedCode?: string | null;
  venueResolvedId?: number | null;
}
