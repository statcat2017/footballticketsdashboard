const TIER_MAP: Record<string, number> = {
  "PL": 1,
  "ELC": 2,
  "NL": 5,
  "NLN": 6,
  "NLS": 6,
};

export function competitionName(code: string): string {
  const names: Record<string, string> = {
    "PL": "Premier League",
    "ELC": "Championship",
  };
  return names[code] ?? code;
}

export function competitionTier(code: string): number {
  return TIER_MAP[code] ?? 2;
}

export function competitionCodeFromDivisionCode(divisionCode: string): string {
  return divisionCode.toUpperCase();
}
