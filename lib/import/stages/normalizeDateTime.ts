import type { ValidationContext } from "../validationContext.ts";
import { parseDateField, parseTimeField } from "../adapters/csv.ts";
import { getAssumedKickoffTime, isWeekend } from "../shared.ts";
import { makeIssue } from "../validation.ts";
import { normalizeKickoffOffset, resolveKickoffInstant } from "../kickoffTime.ts";

function isValidDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearStr, monthStr, dayStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  return day <= new Date(year, month, 0).getDate();
}

export function normalizeDateTime(ctx: ValidationContext): void {
  const { row } = ctx;
  let dateStr: string | null = row.kickoffDate;
  let kickoffTime: string | null = row.kickoffTime;
  let kickoffOffset: string | null = row.kickoffOffset ?? null;

  if (dateStr) {
    const parsed = parseDateField(dateStr);
    if (!parsed) {
      if (!isValidDateString(dateStr)) {
        ctx.warnings.push(makeIssue("invalid_date", `Invalid date: ${dateStr}`, { field: "date", rawValue: dateStr }));
        ctx.hasBlocker = true;
      } else {
        ctx.normalizedDate = dateStr;
      }
    } else {
      dateStr = parsed.date;
      ctx.normalizedDate = parsed.date;
      if (parsed.time) {
        kickoffTime = parsed.time;
        ctx.normalizedTime = parsed.time;
      }
      if (parsed.offset) kickoffOffset = parsed.offset;
    }
  } else {
    ctx.warnings.push(makeIssue("missing_date", "Missing fixture date.", { field: "date" }));
    ctx.hasBlocker = true;
  }

  if (kickoffTime) {
    const parsedTime = parseTimeField(kickoffTime);
    if (!parsedTime) {
      ctx.warnings.push(makeIssue("invalid_time", `Invalid kickoff time: ${kickoffTime}`, { field: "time", rawValue: kickoffTime }));
      ctx.hasBlocker = true;
    } else {
      kickoffTime = parsedTime;
      ctx.normalizedTime = parsedTime;
    }
  } else if (dateStr && !ctx.hasBlocker) {
    kickoffTime = getAssumedKickoffTime(dateStr, ctx.options.kickoffAssumptionPolicy);
    if (kickoffTime) {
      ctx.warnings.push(makeIssue("assumed_time",
        isWeekend(dateStr)
          ? `Kickoff time assumed ${kickoffTime} (weekend).`
          : `Kickoff time assumed ${kickoffTime} (midweek).`,
        { severity: "warning" }
      ));
    }
  }

  if (kickoffOffset && !kickoffTime) {
    ctx.warnings.push(makeIssue("invalid_time", "A source time offset requires a kickoff time.", { field: "time", rawValue: kickoffOffset }));
    ctx.hasBlocker = true;
  }

  if (dateStr && kickoffTime && !ctx.hasBlocker) {
    const normalizedOffset = kickoffOffset ? normalizeKickoffOffset(kickoffOffset) : undefined;
    const resolution = kickoffOffset && !normalizedOffset
      ? { ok: false as const, reason: "invalid" as const }
      : resolveKickoffInstant(dateStr, kickoffTime, normalizedOffset);
    if (!resolution.ok) {
      const issueCode = resolution.reason === "ambiguous"
        ? "ambiguous_kickoff_time"
        : resolution.reason === "nonexistent"
          ? "nonexistent_kickoff_time"
          : "invalid_time";
      const message = resolution.reason === "ambiguous"
        ? `Kickoff ${dateStr} ${kickoffTime} occurs twice in Europe/London; supply the source UTC offset for review.`
        : resolution.reason === "nonexistent"
          ? `Kickoff ${dateStr} ${kickoffTime} does not exist in Europe/London because clocks move forward; correct it or supply an explicit UTC offset.`
          : `Could not resolve kickoff ${dateStr} ${kickoffTime}.`;
      ctx.warnings.push(makeIssue(issueCode, message, { field: "time", rawValue: `${dateStr} ${kickoffTime}` }));
      ctx.hasBlocker = true;
    } else {
      ctx.normalizedOffset = normalizedOffset ?? null;
    }
  } else {
    ctx.normalizedOffset = null;
  }

  if (row.status) {
    const VALID_FIXTURE_STATUSES = ["scheduled", "postponed", "cancelled", "finished", "unknown"];
    if (!VALID_FIXTURE_STATUSES.includes(row.status)) {
      ctx.warnings.push(makeIssue("invalid_status", `Invalid status: ${row.status}. Allowed: ${VALID_FIXTURE_STATUSES.join(", ")}.`, { field: "status" }));
      ctx.hasBlocker = true;
    } else {
      ctx.normalizedStatus = row.status;
    }
  } else {
    ctx.normalizedStatus = null;
  }
}
