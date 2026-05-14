export function defaultDateRange(now = new Date()): { dateFrom: string; dateTo: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });
  const from = fmt.format(now);

  const endDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const to = fmt.format(endDate);

  return { dateFrom: from, dateTo: to };
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeDateRange(filter: string): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const day = today.getDay();

  const friday = new Date(today);
  if (day >= 2 && day <= 4) {
    friday.setDate(today.getDate() + (5 - day));
  } else {
    friday.setDate(today.getDate() - ((day + 2) % 7));
  }

  if (filter === "this-weekend") {
    const start = today > friday ? today : friday;
    const monday = new Date(friday);
    monday.setDate(friday.getDate() + 3);
    return { dateFrom: toDateString(start), dateTo: toDateString(monday) };
  }

  if (filter === "next-weekend") {
    const nextFriday = new Date(friday);
    nextFriday.setDate(friday.getDate() + 7);
    const nextMonday = new Date(nextFriday);
    nextMonday.setDate(nextFriday.getDate() + 3);
    return { dateFrom: toDateString(nextFriday), dateTo: toDateString(nextMonday) };
  }

  return defaultDateRange(today);
}
