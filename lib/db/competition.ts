export function competitionName(code: string): string {
  if (code === "PL") {
    return "Premier League";
  }
  if (code === "ELC") {
    return "Championship";
  }
  return code;
}

export function competitionTier(code: string): number {
  if (code === "PL") {
    return 1;
  }
  if (code === "ELC") {
    return 2;
  }
  return 2;
}
