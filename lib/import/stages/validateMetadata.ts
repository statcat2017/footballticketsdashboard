import type { ValidationContext } from "../validationContext.ts";
import { makeIssue } from "../validation.ts";

export function validateMetadata(ctx: ValidationContext): void {
  const { row } = ctx;

  if (!row.ticketUrl) {
    ctx.warnings.push(makeIssue("missing_ticket_info", "No ticket information provided.", { severity: "warning" }));
  }

  if (row.sourceUrl) {
    try {
      const parsed = new URL(row.sourceUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        ctx.warnings.push(makeIssue("invalid_source_url", `Source URL uses unsupported protocol: ${parsed.protocol}`, { field: "sourceUrl" }));
      }
    } catch {
      ctx.warnings.push(makeIssue("invalid_source_url", `Source URL is not a valid URL: ${row.sourceUrl}`, { field: "sourceUrl" }));
    }
  }
}
