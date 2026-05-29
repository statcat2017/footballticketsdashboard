export * from "./pyramid-data.ts";

import {
  MEN_PYRAMID_DIVISIONS,
  MEN_PYRAMID_EDGES,
  type PyramidDivisionRow,
  type PyramidSeasonDivisionRow,
  type PyramidMembershipRow,
  type PyramidMovementRow,
  type PyramidEdgeRow,
  type PyramidValidationIssue,
} from "./pyramid-data.ts";

export function computeDivisionDisplayOrder(): Map<number, number> {
  const byLevel = new Map<number, typeof MEN_PYRAMID_DIVISIONS>();
  for (const d of MEN_PYRAMID_DIVISIONS) {
    const group = byLevel.get(d.level) ?? [];
    group.push(d);
    byLevel.set(d.level, group);
  }
  const order = new Map<number, number>();
  for (const [, divs] of byLevel) {
    divs.forEach((d, i) => order.set(d.id, i + 1));
  }
  return order;
}

export function computeEdgeAllocationType(): Map<number, "fixed" | "allocation_dependent"> {
  const divLevel = new Map(MEN_PYRAMID_DIVISIONS.map((d) => [d.id, d.level]));
  const result = new Map<number, "fixed" | "allocation_dependent">();
  for (const edge of MEN_PYRAMID_EDGES) {
    const fromLevel = divLevel.get(edge.from_division_id);
    const toLevel = divLevel.get(edge.to_division_id);
    if (fromLevel == null || toLevel == null) {
      throw new Error(
        `computeEdgeAllocationType: edge ${edge.id} references unknown division (from=${edge.from_division_id}, to=${edge.to_division_id})`
      );
    }
    result.set(edge.id, fromLevel <= 6 && toLevel <= 6 ? "fixed" : "allocation_dependent");
  }
  return result;
}

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
