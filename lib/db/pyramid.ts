export type PyramidStatus = "active" | "retired";
export type SeasonDivisionStatus = "open" | "locked";
export type ClubStatus = "known" | "partial" | "missing";
export type MovementType = "promotion" | "relegation";

export interface PyramidTemplateRow {
  id: number;
  code: string;
  name: string;
  sport: "mens";
  status: PyramidStatus;
}

export interface PyramidDivisionRow {
  id: number;
  template_id: number;
  code: string;
  name: string;
  level: number;
  max_size: number;
}

export interface PyramidEdgeRow {
  id: number;
  from_division_id: number;
  to_division_id: number;
  movement_type: MovementType;
  slots: number;
}

export interface PyramidSeasonRow {
  id: number;
  template_id: number;
  season_label: string;
}

export interface PyramidSeasonDivisionRow {
  id: number;
  season_id: number;
  template_id: number;
  division_id: number;
  status: SeasonDivisionStatus;
  locked_at: string | null;
}

export interface PyramidClubRow {
  id: number;
  name: string;
  aliases: string | null;
  league_name: string | null;
  ground_name: string | null;
  ground_address: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  source_url: string | null;
  verified_at: string | null;
  status: ClubStatus;
}

export interface PyramidMembershipRow {
  id: number;
  season_id: number;
  template_id: number;
  season_division_id: number;
  club_id: number;
}

export interface PyramidMovementRow {
  id: number;
  season_id: number;
  template_id: number;
  club_id: number;
  from_season_division_id: number;
  to_season_division_id: number;
  movement_type: MovementType;
  note: string | null;
  created_at: string;
}

export interface PyramidValidationIssue {
  code: "duplicate_club" | "division_over_capacity" | "invalid_movement" | "season_template_mismatch" | "unknown_season_division";
  message: string;
}

export const MEN_PYRAMID_TEMPLATE: PyramidTemplateRow = {
  id: 1,
  code: "mens",
  name: "Men's English Pyramid",
  sport: "mens",
  status: "active"
};

export const MEN_PYRAMID_DIVISIONS: PyramidDivisionRow[] = [
  { id: 1, template_id: 1, code: "premier-league", name: "Premier League", level: 1, max_size: 20 },
  { id: 2, template_id: 1, code: "championship", name: "Championship", level: 2, max_size: 24 },
  { id: 3, template_id: 1, code: "league-one", name: "League One", level: 3, max_size: 24 },
  { id: 4, template_id: 1, code: "league-two", name: "League Two", level: 4, max_size: 24 },
  { id: 5, template_id: 1, code: "national-league", name: "National League", level: 5, max_size: 24 },
  { id: 6, template_id: 1, code: "national-league-north", name: "National League North", level: 6, max_size: 24 },
  { id: 7, template_id: 1, code: "national-league-south", name: "National League South", level: 6, max_size: 24 },
  { id: 8, template_id: 1, code: "northern-premier-league-premier", name: "Northern Premier League Premier Division", level: 7, max_size: 22 },
  { id: 9, template_id: 1, code: "isthmian-league-premier", name: "Isthmian League Premier Division", level: 7, max_size: 22 },
  { id: 10, template_id: 1, code: "southern-league-premier-central", name: "Southern League Premier Central", level: 7, max_size: 22 },
  { id: 11, template_id: 1, code: "southern-league-premier-south", name: "Southern League Premier South", level: 7, max_size: 22 }
];

export const MEN_PYRAMID_EDGES: PyramidEdgeRow[] = [
  { id: 1, from_division_id: 1, to_division_id: 2, movement_type: "relegation", slots: 3 },
  { id: 2, from_division_id: 2, to_division_id: 1, movement_type: "promotion", slots: 2 },
  { id: 3, from_division_id: 2, to_division_id: 3, movement_type: "relegation", slots: 3 },
  { id: 4, from_division_id: 3, to_division_id: 2, movement_type: "promotion", slots: 3 },
  { id: 5, from_division_id: 3, to_division_id: 4, movement_type: "relegation", slots: 4 },
  { id: 6, from_division_id: 4, to_division_id: 3, movement_type: "promotion", slots: 4 },
  { id: 7, from_division_id: 4, to_division_id: 5, movement_type: "relegation", slots: 2 },
  { id: 8, from_division_id: 5, to_division_id: 4, movement_type: "promotion", slots: 4 },
  { id: 9, from_division_id: 5, to_division_id: 6, movement_type: "relegation", slots: 4 },
  { id: 10, from_division_id: 5, to_division_id: 7, movement_type: "relegation", slots: 4 },
  { id: 11, from_division_id: 6, to_division_id: 5, movement_type: "promotion", slots: 1 },
  { id: 12, from_division_id: 7, to_division_id: 5, movement_type: "promotion", slots: 1 },
  { id: 13, from_division_id: 6, to_division_id: 8, movement_type: "relegation", slots: 4 },
  { id: 14, from_division_id: 6, to_division_id: 10, movement_type: "relegation", slots: 4 },
  { id: 15, from_division_id: 7, to_division_id: 9, movement_type: "relegation", slots: 4 },
  { id: 16, from_division_id: 7, to_division_id: 11, movement_type: "relegation", slots: 4 },
  { id: 17, from_division_id: 8, to_division_id: 6, movement_type: "promotion", slots: 1 },
  { id: 18, from_division_id: 9, to_division_id: 7, movement_type: "promotion", slots: 1 },
  { id: 19, from_division_id: 10, to_division_id: 6, movement_type: "promotion", slots: 1 },
  { id: 20, from_division_id: 11, to_division_id: 7, movement_type: "promotion", slots: 1 }
];

export const MEN_PYRAMID_SEASONS: PyramidSeasonRow[] = [
  { id: 1, template_id: 1, season_label: "2025-26" }
];

export const MEN_PYRAMID_SEASON_DIVISIONS: PyramidSeasonDivisionRow[] = MEN_PYRAMID_DIVISIONS.map((division, index) => ({
  id: index + 1,
  season_id: 1,
  template_id: 1,
  division_id: division.id,
  status: "open",
  locked_at: null
}));

export const MEN_PYRAMID_CLUBS: PyramidClubRow[] = [];
export const MEN_PYRAMID_MEMBERSHIPS: PyramidMembershipRow[] = [];
export const MEN_PYRAMID_MOVEMENTS: PyramidMovementRow[] = [];

export function validatePyramidSeason(
  divisions: PyramidDivisionRow[],
  seasonDivisions: PyramidSeasonDivisionRow[],
  memberships: PyramidMembershipRow[],
  movements: PyramidMovementRow[] = [],
  edges: PyramidEdgeRow[] = MEN_PYRAMID_EDGES
): PyramidValidationIssue[] {
  const issues: PyramidValidationIssue[] = [];
  const divisionById = new Map(divisions.map((division) => [division.id, division]));
  const seasonDivisionById = new Map(seasonDivisions.map((division) => [division.id, division]));
  const seasonKeys = new Set(seasonDivisions.map((division) => `${division.season_id}:${division.template_id}`));

  if (seasonKeys.size > 1) {
    issues.push({
      code: "season_template_mismatch",
      message: "Season divisions from multiple seasons or templates were provided to a single validation run."
    });
  }

  for (const seasonDivision of seasonDivisions) {
    const division = divisionById.get(seasonDivision.division_id);

    if (!division) {
      issues.push({
        code: "season_template_mismatch",
        message: `Season division ${seasonDivision.id} points at an unknown template division.`
      });
      continue;
    }

    if (seasonDivision.template_id !== division.template_id) {
      issues.push({
        code: "season_template_mismatch",
        message: `Season division ${seasonDivision.id} template does not match its template division.`
      });
    }
  }

  const membershipsByClub = new Map<number, PyramidMembershipRow[]>();
  const membershipsBySeasonDivision = new Map<number, PyramidMembershipRow[]>();
  const clubCurrentDivision = new Map<number, number>();

  for (const membership of memberships) {
    const clubMemberships = membershipsByClub.get(membership.club_id) ?? [];
    clubMemberships.push(membership);
    membershipsByClub.set(membership.club_id, clubMemberships);

    const seasonDivision = seasonDivisionById.get(membership.season_division_id);

    if (!seasonDivision) {
      issues.push({
        code: "unknown_season_division",
        message: `Membership ${membership.id} references an unknown season division.`
      });
      continue;
    }

    if (membership.season_id !== seasonDivision.season_id || membership.template_id !== seasonDivision.template_id) {
      issues.push({
        code: "season_template_mismatch",
        message: `Membership ${membership.id} does not match its season division template or season.`
      });
      continue;
    }

    const divisionMemberships = membershipsBySeasonDivision.get(membership.season_division_id) ?? [];
    divisionMemberships.push(membership);
    membershipsBySeasonDivision.set(membership.season_division_id, divisionMemberships);

    if (!clubCurrentDivision.has(membership.club_id)) {
      clubCurrentDivision.set(membership.club_id, membership.season_division_id);
    }
  }

  for (const [clubId, clubMemberships] of membershipsByClub) {
    if (clubMemberships.length > 1) {
      issues.push({
        code: "duplicate_club",
        message: `Club ${clubId} appears in more than one division for the same season.`
      });
    }
  }

  for (const [seasonDivisionId, divisionMemberships] of membershipsBySeasonDivision) {
    const seasonDivision = seasonDivisionById.get(seasonDivisionId);

    if (!seasonDivision) {
      issues.push({
        code: "unknown_season_division",
        message: `Season division ${seasonDivisionId} is unknown.`
      });
      continue;
    }

    const division = divisionById.get(seasonDivision.division_id);

    if (!division || seasonDivision.template_id !== division.template_id) {
      continue;
    }

    if (divisionMemberships.length > division.max_size) {
      issues.push({
        code: "division_over_capacity",
        message: `${division.name} has ${divisionMemberships.length} clubs, above the maximum of ${division.max_size}.`
      });
    }
  }

  const edgeKeys = new Set(
    edges.map((edge) => `${edge.from_division_id}:${edge.to_division_id}:${edge.movement_type}`)
  );

  for (const movement of movements) {
    const fromDivision = seasonDivisionById.get(movement.from_season_division_id);
    const toDivision = seasonDivisionById.get(movement.to_season_division_id);

    if (!fromDivision || !toDivision) {
      issues.push({
        code: "invalid_movement",
        message: `Movement ${movement.id} references an unknown season division.`
      });
      continue;
    }

    if (
      movement.season_id !== fromDivision.season_id ||
      movement.season_id !== toDivision.season_id ||
      movement.template_id !== fromDivision.template_id ||
      movement.template_id !== toDivision.template_id ||
      fromDivision.template_id !== toDivision.template_id
    ) {
      issues.push({
        code: "season_template_mismatch",
        message: `Movement ${movement.id} does not stay within a single season template.`
      });
      continue;
    }

    const clubDivisionId = clubCurrentDivision.get(movement.club_id);

    if (clubDivisionId !== movement.from_season_division_id) {
      issues.push({
        code: "invalid_movement",
        message: `Movement ${movement.id} does not match the club's source division.`
      });
      continue;
    }

    const fromTemplateDivision = divisionById.get(fromDivision.division_id);
    const toTemplateDivision = divisionById.get(toDivision.division_id);

    if (!fromTemplateDivision || !toTemplateDivision) {
      issues.push({
        code: "invalid_movement",
        message: `Movement ${movement.id} references an unknown template division.`
      });
      continue;
    }

    if (!edgeKeys.has(`${fromTemplateDivision.id}:${toTemplateDivision.id}:${movement.movement_type}`)) {
      issues.push({
        code: "invalid_movement",
        message: `Movement ${movement.id} is not allowed between ${fromTemplateDivision.name} and ${toTemplateDivision.name}.`
      });
    }
  }

  return issues;
}
