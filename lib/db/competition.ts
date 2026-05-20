const TIER_MAP: Record<string, number> = {
  "PL": 1,
  "ELC": 2,
  "NL": 5,
  "NLN": 6,
  "NLS": 6,
  "NPLP": 7,
  "ILP": 7,
  "SLPC": 7,
  "SLPS": 7,
  "NPL1E": 8,
  "NPL1M": 8,
  "NPL1W": 8,
  "IL1N": 8,
  "IL1SC": 8,
  "IL1SE": 8,
  "SL1C": 8,
  "SL1S": 8,
};

export function competitionName(code: string): string {
  const names: Record<string, string> = {
    "PL": "Premier League",
    "ELC": "Championship",
    "NPLP": "Northern Premier League Premier Division",
    "ILP": "Isthmian League Premier Division",
    "SLPC": "Southern League Premier Division Central",
    "SLPS": "Southern League Premier Division South",
    "NPL1E": "NPL Division One East",
    "NPL1M": "NPL Division One Midlands",
    "NPL1W": "NPL Division One West",
    "IL1N": "Isthmian League Division One North",
    "IL1SC": "Isthmian League Division One South Central",
    "IL1SE": "Isthmian League Division One South East",
    "SL1C": "Southern League Division One Central",
    "SL1S": "Southern League Division One South",
  };
  return names[code] ?? code;
}

export function competitionTier(code: string): number {
  return TIER_MAP[code] ?? 2;
}

export function competitionCodeFromDivisionCode(divisionCode: string): string {
  return divisionCode.toUpperCase();
}
