export const DEMO_SAMPLE_DATE_RANGE = {
  dateFrom: "2025-04-26",
  dateTo: "2025-05-25"
} as const;

export function defaultDateRange(now = new Date(), daysAhead = 13): { dateFrom: string; dateTo: string } {
  const dateFrom = londonDateString(now);
  return { dateFrom, dateTo: addCalendarDays(dateFrom, daysAhead) };
}

export function inferAssumedKickoff(fixtureDate: string): { time: string; status: "assumed" } {
  const day = new Date(fixtureDate + "T12:00:00Z").getUTCDay();
  const isWeekend = day === 0 || day === 6;
  return {
    time: isWeekend ? "15:00" : "19:45",
    status: "assumed"
  };
}

export function parseKickoffFromDateTime(dateStr: string | null, timeStr: string | null): string | null {
  if (!dateStr) return null;
  return timeStr ? `${dateStr}T${timeStr}:00.000Z` : null;
}

function londonDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function londonWeekday(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

export function computeDateRange(filter: string, now = new Date()): { dateFrom: string; dateTo: string } {
  const today = londonDateString(now);
  const weekday = londonWeekday(today);

  if (filter === "next-14-days") {
    return defaultDateRange(now, 13);
  }

  if (filter === "all-upcoming") {
    return defaultDateRange(now, 365);
  }

  const daysFromTodayToFriday = (5 - weekday + 7) % 7;
  const friday = weekday === 0
    ? addCalendarDays(today, -2)
    : weekday === 6
      ? addCalendarDays(today, -1)
      : addCalendarDays(today, daysFromTodayToFriday);

  if (filter === "this-weekend") {
    const isWeekend = weekday === 5 || weekday === 6 || weekday === 0;
    const dateFrom = isWeekend ? today : friday;
    return { dateFrom, dateTo: addCalendarDays(friday, 2) };
  }

  if (filter === "next-weekend") {
    const nextFriday = addCalendarDays(friday, 7);
    return { dateFrom: nextFriday, dateTo: addCalendarDays(nextFriday, 2) };
  }

  return defaultDateRange(now, 365);
}
