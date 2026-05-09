import type { SourceProvenance, TicketOpportunityLead } from "@/lib/ingestion/ticket-opportunity";

export type AdapterDiagnosticSeverity = "info" | "warning" | "error";

export type AdapterDiagnosticCode =
  | "no_events"
  | "blocked"
  | "robots_disallowed"
  | "login_required"
  | "fetch_failed"
  | "parser_failed"
  | "invalid_lead"
  | "stale_source"
  | "postcode_conflict"
  | "compliance_note";

export interface AdapterDiagnostic {
  severity: AdapterDiagnosticSeverity;
  code: AdapterDiagnosticCode;
  message: string;
  sourceUrl?: string;
  fetchStatus?: SourceProvenance["fetchStatus"];
  evidence?: string;
}

export interface TicketSourceAdapterContext {
  now: Date;
  signal?: AbortSignal;
  fetch: typeof fetch;
}

export interface TicketSourceAdapterResult {
  adapterId: string;
  parserVersion: string;
  fetchedAt: string;
  leads: TicketOpportunityLead[];
  diagnostics: AdapterDiagnostic[];
}

export interface TicketSourceAdapter {
  id: string;
  displayName: string;
  sourceKind: SourceProvenance["sourceKind"];
  parserVersion: string;
  run(context: TicketSourceAdapterContext): Promise<TicketSourceAdapterResult>;
}

export interface ComplianceDecision {
  allowed: boolean;
  code?: Extract<AdapterDiagnosticCode, "blocked" | "robots_disallowed" | "login_required">;
  message?: string;
  sourceUrl?: string;
}

export function createAdapterContext(options: Partial<TicketSourceAdapterContext> = {}): TicketSourceAdapterContext {
  return {
    now: options.now ?? new Date(),
    signal: options.signal,
    fetch: options.fetch ?? fetch
  };
}

export function createAdapterResult(
  adapter: Pick<TicketSourceAdapter, "id" | "parserVersion">,
  leads: TicketOpportunityLead[],
  diagnostics: AdapterDiagnostic[] = [],
  fetchedAt = new Date().toISOString()
): TicketSourceAdapterResult {
  const provenanceDiagnostics = leads.flatMap((lead): AdapterDiagnostic[] => {
    const missingFields: string[] = [];

    if (!lead.source?.sourceUrl) {
      missingFields.push("source.sourceUrl");
    }

    if (!lead.source?.sourceKind) {
      missingFields.push("source.sourceKind");
    }

    if (!lead.source?.fetchStatus) {
      missingFields.push("source.fetchStatus");
    }

    if (!lead.source?.evidenceKind) {
      missingFields.push("source.evidenceKind");
    }

    if (lead.adapterId !== adapter.id) {
      missingFields.push("adapterId");
    }

    if (lead.parserVersion !== adapter.parserVersion) {
      missingFields.push("parserVersion");
    }

    if (missingFields.length === 0) {
      return [];
    }

    return [
      {
        severity: "error",
        code: "invalid_lead",
        message: `Lead ${lead.id || "(missing id)"} is missing required provenance: ${missingFields.join(", ")}`
      }
    ];
  });

  return {
    adapterId: adapter.id,
    parserVersion: adapter.parserVersion,
    fetchedAt,
    leads,
    diagnostics: [...diagnostics, ...provenanceDiagnostics]
  };
}

export function createEmptyAdapterResult(
  adapter: Pick<TicketSourceAdapter, "id" | "parserVersion">,
  sourceUrl: string,
  message = "Source fetched successfully but no public ticket opportunities were found.",
  fetchedAt = new Date().toISOString()
): TicketSourceAdapterResult {
  return createAdapterResult(
    adapter,
    [],
    [{ severity: "info", code: "no_events", message, sourceUrl }],
    fetchedAt
  );
}

export function createBlockedAdapterResult(
  adapter: Pick<TicketSourceAdapter, "id" | "parserVersion">,
  decision: ComplianceDecision,
  fetchedAt = new Date().toISOString()
): TicketSourceAdapterResult {
  return createAdapterResult(
    adapter,
    [],
    [
      {
        severity: "warning",
        code: decision.code ?? "blocked",
        message: decision.message ?? "Source is blocked by compliance policy.",
        sourceUrl: decision.sourceUrl,
        fetchStatus: decision.code === "robots_disallowed" ? "robots_disallowed" : "blocked"
      }
    ],
    fetchedAt
  );
}

export function createParserFailureResult(
  adapter: Pick<TicketSourceAdapter, "id" | "parserVersion">,
  sourceUrl: string,
  error: unknown,
  fetchedAt = new Date().toISOString()
): TicketSourceAdapterResult {
  return createAdapterResult(
    adapter,
    [],
    [
      {
        severity: "error",
        code: "parser_failed",
        message: error instanceof Error ? error.message : "Parser failed.",
        sourceUrl
      }
    ],
    fetchedAt
  );
}

export function assertComplianceAllowed(decision: ComplianceDecision): asserts decision is ComplianceDecision & {
  allowed: true;
} {
  if (!decision.allowed) {
    throw new Error(decision.message ?? "Source is blocked by compliance policy.");
  }
}
