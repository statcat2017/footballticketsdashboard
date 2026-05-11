export interface ClubRow {
  id: number;
  name: string;
  football_data_team_id: number | null;
  aliases: string | null;
  short_name: string | null;
  venue_id: number;
}

export interface FootballDataTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
}

export function buildClubLookup(clubs: ClubRow[]): Map<string, ClubRow> {
  const lookup = new Map<string, ClubRow>();

  for (const club of clubs) {
    if (club.football_data_team_id !== null) {
      lookup.set(teamIdKey(club.football_data_team_id), club);
    }

    const aliases = club.aliases?.split("|") ?? [];

    for (const key of clubKeys(club.name, club.short_name ?? undefined, ...aliases)) {
      lookup.set(key, club);
    }
  }

  return lookup;
}

export function findClub(
  clubLookup: Map<string, ClubRow>,
  team: FootballDataTeam
): ClubRow | undefined {
  const byId = clubLookup.get(teamIdKey(team.id));

  if (byId) {
    return byId;
  }

  for (const key of clubKeys(team.name, team.shortName, team.tla)) {
    const club = clubLookup.get(key);

    if (club) {
      return club;
    }
  }

  return undefined;
}

function teamIdKey(id: number): string {
  return `football-data:${id}`;
}

function clubKeys(...values: Array<string | undefined>): string[] {
  return values
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => {
      const normalized = normalizeClubName(value);
      const withoutSuffix = normalized.replace(/\b(afc|fc|football club)\b/g, "").replace(/\s+/g, " ").trim();
      return [normalized, withoutSuffix];
    });
}

export function normalizeClubName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeStatus(status: string): "scheduled" | "postponed" | "cancelled" | "finished" | "unknown" {
  switch (status) {
    case "SCHEDULED":
    case "TIMED":
    case "IN_PLAY":
    case "PAUSED":
      return "scheduled";
    case "POSTPONED":
    case "SUSPENDED":
      return "postponed";
    case "CANCELLED":
      return "cancelled";
    case "FINISHED":
    case "AWARDED":
      return "finished";
    default:
      return "unknown";
  }
}
