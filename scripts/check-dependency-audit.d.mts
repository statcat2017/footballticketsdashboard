export interface DependencyAuditResult {
  vulnerabilities?: Record<string, {
    severity: string;
    via?: Array<string | { url?: string }>;
  }>;
  metadata?: {
    vulnerabilities?: { total?: number };
  };
}

export declare function assertDependencyAudits(
  fullAudit: DependencyAuditResult,
  productionAudit: DependencyAuditResult,
  now?: Date
): string[];
