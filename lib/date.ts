export function defaultDateRange(now = new Date()): { dateFrom: string; dateTo: string } {
  const from = new Date(now);
  const to = new Date(now);
  to.setDate(to.getDate() + 10);

  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10)
  };
}
