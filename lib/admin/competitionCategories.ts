export const PUBLIC_COMPETITION_CATEGORY_OPTIONS = [
  { value: "premier-league", label: "Premier League" },
  { value: "efl", label: "EFL" },
  { value: "non-league", label: "Non League" },
  { value: "womens", label: "Women’s football" },
  { value: "cup", label: "Cup" },
  { value: "friendly", label: "Friendly" },
  { value: "uncategorized", label: "Uncategorized" },
] as const;

export function isPublicCompetitionCategory(value: string): boolean {
  return PUBLIC_COMPETITION_CATEGORY_OPTIONS.some((option) => option.value === value);
}
