import type { AppDatabase } from "../db/adapter";
import type { KickoffAssumptionPolicy } from "./types";

export async function getCurrentSeasonLabel(db: AppDatabase): Promise<string | undefined> {
  const season = await db.get<{ label: string }>(
    `SELECT label FROM fixture_seasons WHERE is_current = 1 LIMIT 1`
  );
  return season?.label;
}

export function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + "T00:00:00Z").getUTCDay();
  return day === 0 || day === 6;
}

export function getAssumedKickoffTime(
  dateStr: string,
  policy?: KickoffAssumptionPolicy
): string | null {
  if (policy?.enabled === false) return null;

  const defaultTime = isWeekend(dateStr) ? "15:00" : "19:45";
  const configuredTime = isWeekend(dateStr) ? policy?.weekend : policy?.midweek;
  return configuredTime === undefined ? defaultTime : configuredTime;
}
