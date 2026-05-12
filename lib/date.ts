export function defaultDateRange(now = new Date()): { dateFrom: string; dateTo: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });
  const from = fmt.format(now);

  const endDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const to = fmt.format(endDate);

  return { dateFrom: from, dateTo: to };
}
