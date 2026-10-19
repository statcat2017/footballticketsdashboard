const LONDON_TIME_ZONE = "Europe/London";
const minuteMs = 60_000;

export type KickoffInstantResolution =
  | { ok: true; kickoffAt: string; timeBasis: string }
  | { ok: false; reason: "ambiguous" | "nonexistent" | "invalid" };

export interface LondonKickoffParts {
  date: string;
  time: string;
}

export function normalizeKickoffOffset(value: string): string | undefined {
  if (value.toUpperCase() === "Z") return "+00:00";

  const match = /^([+-])(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;

  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 23 || minutes > 59) return undefined;

  return `${match[1]}${match[2]}:${match[3]}`;
}

export function resolveKickoffInstant(
  date: string,
  time: string,
  sourceOffset?: string | null
): KickoffInstantResolution {
  const parts = parseLocalDateTime(date, time);
  if (!parts) return { ok: false, reason: "invalid" };

  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);

  if (sourceOffset) {
    const normalizedOffset = normalizeKickoffOffset(sourceOffset);
    if (!normalizedOffset) return { ok: false, reason: "invalid" };
    const offsetMinutes = offsetToMinutes(normalizedOffset);
    return {
      ok: true,
      kickoffAt: new Date(localAsUtc - offsetMinutes * minuteMs).toISOString(),
      timeBasis: normalizedOffset
    };
  }

  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = new Date(localAsUtc + hours * 60 * minuteMs);
    offsets.add(londonOffsetMinutes(probe));
  }

  const candidates = Array.from(offsets)
    .map((offset) => new Date(localAsUtc - offset * minuteMs))
    .filter((candidate) => hasLondonDateTime(candidate, parts));

  if (candidates.length === 0) return { ok: false, reason: "nonexistent" };
  if (candidates.length > 1) return { ok: false, reason: "ambiguous" };

  return {
    ok: true,
    kickoffAt: candidates[0].toISOString(),
    timeBasis: LONDON_TIME_ZONE
  };
}

export function formatKickoffInLondon(instant: string): LondonKickoffParts | null {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) return null;

  const parts = londonDateTimeParts(date);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  };
}

export function getLondonKickoffParts(
  date: string | null | undefined,
  time: string | null | undefined,
  sourceOffset?: string | null,
): LondonKickoffParts | null {
  if (!date || !time) return null;
  const resolution = resolveKickoffInstant(date, time, sourceOffset);
  return resolution.ok ? formatKickoffInLondon(resolution.kickoffAt) : null;
}

export function getLondonKickoffDate(
  date: string | null | undefined,
  time: string | null | undefined,
  sourceOffset?: string | null,
): string | null {
  return getLondonKickoffParts(date, time, sourceOffset)?.date ?? date ?? null;
}

function parseLocalDateTime(date: string, time: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [, yearValue, monthValue, dayValue] = dateMatch;
  const [, hourValue, minuteValue] = timeMatch;
  const parts = {
    year: Number(yearValue),
    month: Number(monthValue),
    day: Number(dayValue),
    hour: Number(hourValue),
    minute: Number(minuteValue)
  };

  if (parts.month < 1 || parts.month > 12 || parts.hour > 23 || parts.minute > 59) return null;
  const dateCheck = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(dateCheck.getTime()) || dateCheck.toISOString().slice(0, 10) !== date) return null;

  return parts;
}

function offsetToMinutes(offset: string): number {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) return 0;
  const value = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "+" ? value : -value;
}

function londonOffsetMinutes(instant: Date): number {
  const parts = londonDateTimeParts(instant);
  const localAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute)
  );
  return Math.round((localAsUtc - instant.getTime()) / minuteMs);
}

function hasLondonDateTime(
  instant: Date,
  expected: { year: number; month: number; day: number; hour: number; minute: number }
): boolean {
  const actual = londonDateTimeParts(instant);
  return Number(actual.year) === expected.year
    && Number(actual.month) === expected.month
    && Number(actual.day) === expected.day
    && Number(actual.hour) === expected.hour
    && Number(actual.minute) === expected.minute;
}

function londonDateTimeParts(instant: Date): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(instant).map((part) => [part.type, part.value]));
}
