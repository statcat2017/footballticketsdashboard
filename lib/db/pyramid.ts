export type PyramidStatus = "active" | "retired";
export type SeasonDivisionStatus = "open" | "locked";
export type ClubStatus = "known" | "partial" | "missing";
export type MovementType = "promotion" | "relegation";
export type AllocationType = "fixed" | "allocation_dependent";

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
  display_order?: number | null;
}

export interface PyramidEdgeRow {
  id: number;
  from_division_id: number;
  to_division_id: number;
  movement_type: MovementType;
  allocation_type?: AllocationType;
  notes?: string | null;
  source_url?: string | null;
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

export interface ClubVenueAssignmentRow {
  id: number;
  club_id: number;
  venue_id: number;
  effective_from: string;
  effective_to: string | null;
  is_primary: number;
}

export interface ClubVenueAssignmentRow {
  id: number;
  club_id: number;
  venue_id: number;
  effective_from: string;
  effective_to: string | null;
  is_primary: number;
}

export interface PyramidValidationIssue {
  code: "duplicate_club" | "division_over_capacity" | "invalid_movement" | "season_template_mismatch" | "unknown_season_division";
  message: string;
}

/** Compute display_order within each level from the seed-array order. */
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

/** Compute allocation_type from connected division levels. */
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
  { id: 10, template_id: 1, code: "southern-league-premier-central", name: "Southern Football League Premier Division Central", level: 7, max_size: 22 },
  { id: 11, template_id: 1, code: "southern-league-premier-south", name: "Southern Football League Premier Division South", level: 7, max_size: 22 },
  { id: 12, template_id: 1, code: "nwcfl-premier", name: "North West Counties League Premier Division", level: 9, max_size: 24 },
  { id: 13, template_id: 1, code: "nwcfl-division-one-north", name: "North West Counties League Division One North", level: 10, max_size: 18 },
  { id: 14, template_id: 1, code: "nwcfl-division-one-south", name: "North West Counties League Division One South", level: 10, max_size: 19 },
  // ── Level 8: Step 4 ─────────────────────────────────────────
  { id: 15, template_id: 1, code: "npl-division-one-east", name: "Northern Premier League Division One East", level: 8, max_size: 22 },
  { id: 16, template_id: 1, code: "npl-division-one-midlands", name: "Northern Premier League Division One Midlands", level: 8, max_size: 22 },
  { id: 17, template_id: 1, code: "npl-division-one-west", name: "Northern Premier League Division One West", level: 8, max_size: 22 },
  { id: 18, template_id: 1, code: "isthmian-division-one-north", name: "Isthmian League Division One North", level: 8, max_size: 22 },
  { id: 19, template_id: 1, code: "isthmian-division-one-south-central", name: "Isthmian League Division One South Central", level: 8, max_size: 22 },
  { id: 20, template_id: 1, code: "isthmian-division-one-south-east", name: "Isthmian League Division One South East", level: 8, max_size: 22 },
  { id: 21, template_id: 1, code: "southern-division-one-central", name: "Southern Football League Division One Central", level: 8, max_size: 22 },
  { id: 22, template_id: 1, code: "southern-division-one-south", name: "Southern Football League Division One South", level: 8, max_size: 22 },
  // ── Level 9: Step 5 (feeder leagues) ────────────────────────
  { id: 23, template_id: 1, code: "combined-counties-premier-north", name: "Combined Counties League Premier Division North", level: 9, max_size: 20 },
  { id: 24, template_id: 1, code: "combined-counties-premier-south", name: "Combined Counties League Premier Division South", level: 9, max_size: 20 },
  { id: 25, template_id: 1, code: "eastern-counties-premier", name: "Eastern Counties League Premier Division", level: 9, max_size: 18 },
  { id: 26, template_id: 1, code: "essex-senior-league", name: "Essex Senior League", level: 9, max_size: 20 },
  { id: 27, template_id: 1, code: "hellenic-premier", name: "Hellenic League Premier Division", level: 9, max_size: 20 },
  { id: 28, template_id: 1, code: "midland-premier", name: "Midland League Premier Division", level: 9, max_size: 18 },
  { id: 29, template_id: 1, code: "northern-counties-east-premier", name: "Northern Counties East League Premier Division", level: 9, max_size: 21 },
  { id: 30, template_id: 1, code: "northern-league-division-one", name: "Northern League Division One", level: 9, max_size: 20 },
  { id: 31, template_id: 1, code: "southern-counties-east-premier", name: "Southern Counties East League Premier Division", level: 9, max_size: 19 },
  { id: 32, template_id: 1, code: "spartan-south-midlands-premier", name: "Spartan South Midlands League Premier Division", level: 9, max_size: 20 },
  { id: 33, template_id: 1, code: "southern-combination-premier", name: "Southern Combination League Premier Division", level: 9, max_size: 20 },
  { id: 34, template_id: 1, code: "united-counties-premier-north", name: "United Counties League Premier Division North", level: 9, max_size: 20 },
  { id: 35, template_id: 1, code: "united-counties-premier-south", name: "United Counties League Premier Division South", level: 9, max_size: 20 },
  { id: 36, template_id: 1, code: "wessex-premier", name: "Wessex League Premier Division", level: 9, max_size: 20 },
  { id: 37, template_id: 1, code: "western-premier", name: "Western League Premier Division", level: 9, max_size: 20 },
  // ── Level 10: Step 6 (feeder leagues) ───────────────────────
  { id: 38, template_id: 1, code: "combined-counties-division-one", name: "Combined Counties League Division One", level: 10, max_size: 20 },
  { id: 39, template_id: 1, code: "eastern-counties-division-one-north", name: "Eastern Counties League Division One North", level: 10, max_size: 20 },
  { id: 40, template_id: 1, code: "eastern-counties-division-one-south", name: "Eastern Counties League Division One South", level: 10, max_size: 20 },
  { id: 41, template_id: 1, code: "hellenic-division-one", name: "Hellenic League Division One", level: 10, max_size: 20 },
  { id: 42, template_id: 1, code: "midland-division-one", name: "Midland League Division One", level: 10, max_size: 22 },
  { id: 43, template_id: 1, code: "northern-counties-east-division-one", name: "Northern Counties East League Division One", level: 10, max_size: 20 },
  { id: 44, template_id: 1, code: "northern-league-division-two", name: "Northern League Division Two", level: 10, max_size: 22 },
  { id: 45, template_id: 1, code: "southern-counties-east-division-one", name: "Southern Counties East League Division One", level: 10, max_size: 18 },
  { id: 46, template_id: 1, code: "south-west-peninsula-east", name: "South West Peninsula League Premier Division East", level: 10, max_size: 16 },
  { id: 47, template_id: 1, code: "south-west-peninsula-west", name: "South West Peninsula League Premier Division West", level: 10, max_size: 16 },
  { id: 48, template_id: 1, code: "spartan-south-midlands-division-one", name: "Spartan South Midlands League Division One", level: 10, max_size: 21 },
  { id: 49, template_id: 1, code: "southern-combination-division-one", name: "Southern Combination League Division One", level: 10, max_size: 20 },
  { id: 50, template_id: 1, code: "united-counties-division-one", name: "United Counties League Division One", level: 10, max_size: 22 },
  { id: 51, template_id: 1, code: "wessex-division-one", name: "Wessex League Division One", level: 10, max_size: 22 },
  { id: 52, template_id: 1, code: "western-division-one", name: "Western League Division One", level: 10, max_size: 20 },
];

export const MEN_PYRAMID_EDGES: PyramidEdgeRow[] = [
  { id: 1, from_division_id: 1, to_division_id: 2, movement_type: "relegation" },
  { id: 2, from_division_id: 2, to_division_id: 1, movement_type: "promotion" },
  { id: 3, from_division_id: 2, to_division_id: 3, movement_type: "relegation" },
  { id: 4, from_division_id: 3, to_division_id: 2, movement_type: "promotion" },
  { id: 5, from_division_id: 3, to_division_id: 4, movement_type: "relegation" },
  { id: 6, from_division_id: 4, to_division_id: 3, movement_type: "promotion" },
  { id: 7, from_division_id: 4, to_division_id: 5, movement_type: "relegation" },
  { id: 8, from_division_id: 5, to_division_id: 4, movement_type: "promotion" },
  { id: 9, from_division_id: 5, to_division_id: 6, movement_type: "relegation" },
  { id: 10, from_division_id: 5, to_division_id: 7, movement_type: "relegation" },
  { id: 11, from_division_id: 6, to_division_id: 5, movement_type: "promotion" },
  { id: 12, from_division_id: 7, to_division_id: 5, movement_type: "promotion" },
  { id: 13, from_division_id: 6, to_division_id: 8, movement_type: "relegation" },
  { id: 14, from_division_id: 6, to_division_id: 10, movement_type: "relegation" },
  { id: 15, from_division_id: 7, to_division_id: 9, movement_type: "relegation" },
  { id: 16, from_division_id: 7, to_division_id: 11, movement_type: "relegation" },
  { id: 17, from_division_id: 8, to_division_id: 6, movement_type: "promotion" },
  { id: 18, from_division_id: 9, to_division_id: 7, movement_type: "promotion" },
  { id: 19, from_division_id: 10, to_division_id: 6, movement_type: "promotion" },
  { id: 20, from_division_id: 11, to_division_id: 7, movement_type: "promotion" },
  // ── Level 7 → Level 8 (relegation) ──────────────────────────
  { id: 21, from_division_id: 8, to_division_id: 15, movement_type: "relegation" },
  { id: 22, from_division_id: 8, to_division_id: 16, movement_type: "relegation" },
  { id: 23, from_division_id: 8, to_division_id: 17, movement_type: "relegation" },
  { id: 24, from_division_id: 9, to_division_id: 18, movement_type: "relegation" },
  { id: 25, from_division_id: 9, to_division_id: 19, movement_type: "relegation" },
  { id: 26, from_division_id: 9, to_division_id: 20, movement_type: "relegation" },
  { id: 27, from_division_id: 10, to_division_id: 21, movement_type: "relegation" },
  { id: 28, from_division_id: 11, to_division_id: 22, movement_type: "relegation" },
  // ── Level 8 → Level 7 (promotion) ───────────────────────────
  { id: 29, from_division_id: 15, to_division_id: 8, movement_type: "promotion" },
  { id: 30, from_division_id: 16, to_division_id: 8, movement_type: "promotion" },
  { id: 31, from_division_id: 17, to_division_id: 8, movement_type: "promotion" },
  { id: 32, from_division_id: 18, to_division_id: 9, movement_type: "promotion" },
  { id: 33, from_division_id: 19, to_division_id: 9, movement_type: "promotion" },
  { id: 34, from_division_id: 20, to_division_id: 9, movement_type: "promotion" },
  { id: 35, from_division_id: 21, to_division_id: 10, movement_type: "promotion" },
  { id: 36, from_division_id: 22, to_division_id: 11, movement_type: "promotion" },
  // ── Level 8 → Level 9 (relegation) ──────────────────────────
  { id: 37, from_division_id: 15, to_division_id: 30, movement_type: "relegation" },
  { id: 38, from_division_id: 15, to_division_id: 29, movement_type: "relegation" },
  { id: 39, from_division_id: 15, to_division_id: 34, movement_type: "relegation" },
  { id: 40, from_division_id: 16, to_division_id: 34, movement_type: "relegation" },
  { id: 41, from_division_id: 17, to_division_id: 12, movement_type: "relegation" },
  { id: 42, from_division_id: 18, to_division_id: 25, movement_type: "relegation" },
  { id: 43, from_division_id: 18, to_division_id: 26, movement_type: "relegation" },
  { id: 44, from_division_id: 18, to_division_id: 32, movement_type: "relegation" },
  { id: 45, from_division_id: 19, to_division_id: 23, movement_type: "relegation" },
  { id: 46, from_division_id: 19, to_division_id: 24, movement_type: "relegation" },
  { id: 47, from_division_id: 19, to_division_id: 33, movement_type: "relegation" },
  { id: 48, from_division_id: 19, to_division_id: 36, movement_type: "relegation" },
  { id: 49, from_division_id: 20, to_division_id: 33, movement_type: "relegation" },
  { id: 50, from_division_id: 20, to_division_id: 31, movement_type: "relegation" },
  { id: 51, from_division_id: 21, to_division_id: 23, movement_type: "relegation" },
  { id: 52, from_division_id: 21, to_division_id: 32, movement_type: "relegation" },
  { id: 53, from_division_id: 22, to_division_id: 24, movement_type: "relegation" },
  { id: 54, from_division_id: 22, to_division_id: 27, movement_type: "relegation" },
  { id: 55, from_division_id: 22, to_division_id: 37, movement_type: "relegation" },
  { id: 56, from_division_id: 22, to_division_id: 36, movement_type: "relegation" },
  // ── Level 9 → Level 8 (promotion) ───────────────────────────
  { id: 57, from_division_id: 30, to_division_id: 15, movement_type: "promotion" },
  { id: 58, from_division_id: 29, to_division_id: 15, movement_type: "promotion" },
  { id: 59, from_division_id: 34, to_division_id: 16, movement_type: "promotion" },
  { id: 60, from_division_id: 28, to_division_id: 16, movement_type: "promotion" },
  { id: 61, from_division_id: 12, to_division_id: 17, movement_type: "promotion" },
  { id: 62, from_division_id: 25, to_division_id: 18, movement_type: "promotion" },
  { id: 63, from_division_id: 26, to_division_id: 18, movement_type: "promotion" },
  { id: 64, from_division_id: 23, to_division_id: 19, movement_type: "promotion" },
  { id: 65, from_division_id: 24, to_division_id: 19, movement_type: "promotion" },
  { id: 66, from_division_id: 33, to_division_id: 20, movement_type: "promotion" },
  { id: 67, from_division_id: 31, to_division_id: 20, movement_type: "promotion" },
  { id: 68, from_division_id: 32, to_division_id: 21, movement_type: "promotion" },
  { id: 69, from_division_id: 35, to_division_id: 21, movement_type: "promotion" },
  { id: 70, from_division_id: 27, to_division_id: 22, movement_type: "promotion" },
  { id: 71, from_division_id: 36, to_division_id: 22, movement_type: "promotion" },
  { id: 72, from_division_id: 37, to_division_id: 22, movement_type: "promotion" },
  // ── Level 9 → Level 10 (relegation) ─────────────────────────
  { id: 73, from_division_id: 12, to_division_id: 13, movement_type: "relegation" },
  { id: 74, from_division_id: 12, to_division_id: 14, movement_type: "relegation" },
  { id: 75, from_division_id: 23, to_division_id: 38, movement_type: "relegation" },
  { id: 76, from_division_id: 24, to_division_id: 38, movement_type: "relegation" },
  { id: 77, from_division_id: 25, to_division_id: 39, movement_type: "relegation" },
  { id: 78, from_division_id: 25, to_division_id: 40, movement_type: "relegation" },
  { id: 79, from_division_id: 27, to_division_id: 41, movement_type: "relegation" },
  { id: 80, from_division_id: 28, to_division_id: 42, movement_type: "relegation" },
  { id: 81, from_division_id: 29, to_division_id: 43, movement_type: "relegation" },
  { id: 82, from_division_id: 30, to_division_id: 44, movement_type: "relegation" },
  { id: 83, from_division_id: 31, to_division_id: 45, movement_type: "relegation" },
  { id: 84, from_division_id: 32, to_division_id: 48, movement_type: "relegation" },
  { id: 85, from_division_id: 33, to_division_id: 49, movement_type: "relegation" },
  { id: 86, from_division_id: 34, to_division_id: 50, movement_type: "relegation" },
  { id: 87, from_division_id: 35, to_division_id: 50, movement_type: "relegation" },
  { id: 88, from_division_id: 36, to_division_id: 51, movement_type: "relegation" },
  { id: 89, from_division_id: 37, to_division_id: 52, movement_type: "relegation" },
  // ── Level 10 → Level 9 (promotion) ──────────────────────────
  { id: 90, from_division_id: 38, to_division_id: 23, movement_type: "promotion" },
  { id: 91, from_division_id: 38, to_division_id: 24, movement_type: "promotion" },
  { id: 92, from_division_id: 39, to_division_id: 25, movement_type: "promotion" },
  { id: 93, from_division_id: 40, to_division_id: 25, movement_type: "promotion" },
  { id: 94, from_division_id: 41, to_division_id: 27, movement_type: "promotion" },
  { id: 95, from_division_id: 42, to_division_id: 28, movement_type: "promotion" },
  { id: 96, from_division_id: 43, to_division_id: 29, movement_type: "promotion" },
  { id: 97, from_division_id: 44, to_division_id: 30, movement_type: "promotion" },
  { id: 98, from_division_id: 45, to_division_id: 31, movement_type: "promotion" },
  { id: 99, from_division_id: 46, to_division_id: 37, movement_type: "promotion" },
  { id: 100, from_division_id: 47, to_division_id: 37, movement_type: "promotion" },
  { id: 101, from_division_id: 48, to_division_id: 32, movement_type: "promotion" },
  { id: 102, from_division_id: 49, to_division_id: 33, movement_type: "promotion" },
  { id: 103, from_division_id: 50, to_division_id: 34, movement_type: "promotion" },
  { id: 104, from_division_id: 50, to_division_id: 35, movement_type: "promotion" },
  { id: 105, from_division_id: 51, to_division_id: 36, movement_type: "promotion" },
  { id: 106, from_division_id: 52, to_division_id: 37, movement_type: "promotion" },
  // ── Essex Senior / NWCFL internal promotion paths (Level 10 → Level 9) ──
  { id: 107, from_division_id: 26, to_division_id: 39, movement_type: "relegation" },
  { id: 108, from_division_id: 26, to_division_id: 40, movement_type: "relegation" },
  { id: 109, from_division_id: 39, to_division_id: 26, movement_type: "promotion" },
  { id: 110, from_division_id: 40, to_division_id: 26, movement_type: "promotion" },
  // ── Additional allocation-dependent promotion paths (Level 9 → Level 8) ─
  { id: 111, from_division_id: 23, to_division_id: 20, movement_type: "promotion" },
  { id: 112, from_division_id: 24, to_division_id: 20, movement_type: "promotion" },
  { id: 113, from_division_id: 24, to_division_id: 22, movement_type: "promotion" },
  { id: 114, from_division_id: 33, to_division_id: 19, movement_type: "promotion" },
  { id: 115, from_division_id: 31, to_division_id: 19, movement_type: "promotion" },
  { id: 116, from_division_id: 35, to_division_id: 16, movement_type: "promotion" },
  { id: 117, from_division_id: 34, to_division_id: 15, movement_type: "promotion" },
  { id: 118, from_division_id: 28, to_division_id: 15, movement_type: "promotion" },
  { id: 119, from_division_id: 32, to_division_id: 22, movement_type: "promotion" },
  { id: 120, from_division_id: 27, to_division_id: 21, movement_type: "promotion" },
  // ── Additional allocation-dependent relegation paths (Level 8 → Level 9) ──
  { id: 121, from_division_id: 20, to_division_id: 23, movement_type: "relegation" },
  { id: 122, from_division_id: 20, to_division_id: 24, movement_type: "relegation" },
  { id: 123, from_division_id: 22, to_division_id: 32, movement_type: "relegation" },
  { id: 124, from_division_id: 21, to_division_id: 27, movement_type: "relegation" },
  { id: 125, from_division_id: 16, to_division_id: 28, movement_type: "relegation" },
  { id: 126, from_division_id: 15, to_division_id: 28, movement_type: "relegation" },
  { id: 127, from_division_id: 19, to_division_id: 31, movement_type: "relegation" },
  // ── NWCFL internal promotion (Level 10 → Level 9) ──────────
  { id: 128, from_division_id: 13, to_division_id: 12, movement_type: "promotion" },
  { id: 129, from_division_id: 14, to_division_id: 12, movement_type: "promotion" },
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

export const MEN_PYRAMID_CLUBS: PyramidClubRow[] = [
  // ── Premier League (season_division_id: 1) ──────────────────────
      { id: 1, name: "Arsenal", aliases: null, league_name: null, source_url: "https://www.arsenal.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 2, name: "Aston Villa", aliases: null, league_name: null, source_url: "https://www.avfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 3, name: "Bournemouth", aliases: null, league_name: null, source_url: "https://www.afcb.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 4, name: "Brentford", aliases: null, league_name: null, source_url: "https://tickets.brentfordfc.com", verified_at: "2026-05-15", status: "known" },
      { id: 5, name: "Brighton & Hove Albion", aliases: null, league_name: null, source_url: "https://tickets.brightonandhovealbion.com", verified_at: "2026-05-15", status: "known" },
      { id: 6, name: "Burnley", aliases: null, league_name: null, source_url: "https://www.burnleyfc.com/en/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 7, name: "Chelsea", aliases: null, league_name: null, source_url: "https://www.chelseafc.com/en/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 8, name: "Crystal Palace", aliases: null, league_name: null, source_url: "https://www.cpfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 9, name: "Everton", aliases: null, league_name: null, source_url: "https://www.evertonfc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 10, name: "Fulham", aliases: null, league_name: null, source_url: "https://www.fulhamfc.com/en/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 11, name: "Leeds United", aliases: null, league_name: null, source_url: "https://www.leedsunited.com/en/tickets-and-hospitality", verified_at: "2026-05-15", status: "known" },
      { id: 12, name: "Liverpool", aliases: null, league_name: null, source_url: "https://www.liverpoolfc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 13, name: "Manchester City", aliases: null, league_name: null, source_url: "https://www.mancity.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 14, name: "Manchester United", aliases: null, league_name: null, source_url: "https://tickets.manutd.com", verified_at: "2026-05-15", status: "known" },
      { id: 15, name: "Newcastle United", aliases: null, league_name: null, source_url: "https://www.newcastleunited.com/en/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 16, name: "Nottingham Forest", aliases: null, league_name: null, source_url: "https://www.nottinghamforest.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 17, name: "Sunderland", aliases: null, league_name: null, source_url: "https://www.safc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 18, name: "Tottenham Hotspur", aliases: null, league_name: null, source_url: "https://www.tottenhamhotspur.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 19, name: "West Ham United", aliases: null, league_name: null, source_url: "https://www.whufc.com/en/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 20, name: "Wolverhampton Wanderers", aliases: null, league_name: null, source_url: "https://www.wolves.co.uk/tickets-hospitality", verified_at: "2026-05-15", status: "known" },
  // ── Championship (season_division_id: 2) ──────────────────────
      { id: 21, name: "Birmingham City", aliases: null, league_name: null, source_url: "https://www.bcfc.com/tickets/", verified_at: "2026-05-15", status: "known" },
      { id: 22, name: "Blackburn Rovers", aliases: null, league_name: null, source_url: "https://www.rovers.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 23, name: "Bristol City", aliases: null, league_name: null, source_url: "https://www.bcfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 24, name: "Charlton Athletic", aliases: null, league_name: null, source_url: "https://www.charltonafc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 25, name: "Coventry City", aliases: null, league_name: null, source_url: "https://www.ccfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 26, name: "Derby County", aliases: null, league_name: null, source_url: "https://www.dcfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 27, name: "Hull City", aliases: null, league_name: null, source_url: "https://www.wearehullcity.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 28, name: "Ipswich Town", aliases: null, league_name: null, source_url: "https://www.itfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 29, name: "Leicester City", aliases: null, league_name: null, source_url: "https://www.lcfc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 30, name: "Middlesbrough", aliases: null, league_name: null, source_url: "https://www.mfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 31, name: "Millwall", aliases: null, league_name: null, source_url: "https://www.millwallfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 32, name: "Norwich City", aliases: null, league_name: null, source_url: "https://www.canaries.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 33, name: "Oxford United", aliases: null, league_name: null, source_url: "https://www.oufc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 34, name: "Portsmouth", aliases: null, league_name: null, source_url: "https://www.portsmouthfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 35, name: "Preston North End", aliases: null, league_name: null, source_url: "https://www.pnefc.net/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 36, name: "Queens Park Rangers", aliases: null, league_name: null, source_url: "https://www.eticketing.co.uk/qpr/", verified_at: "2026-05-15", status: "known" },
      { id: 37, name: "Sheffield United", aliases: null, league_name: null, source_url: "https://www.sufc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 38, name: "Sheffield Wednesday", aliases: null, league_name: null, source_url: "https://www.swfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 39, name: "Southampton", aliases: null, league_name: null, source_url: "https://www.southamptonfc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 40, name: "Stoke City", aliases: null, league_name: null, source_url: "https://www.stokecityfc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 41, name: "Swansea City", aliases: null, league_name: null, source_url: "https://www.swanseacity.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 42, name: "Watford", aliases: null, league_name: null, source_url: "https://www.watfordfc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 43, name: "West Bromwich Albion", aliases: null, league_name: null, source_url: "https://www.wba.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 44, name: "Wrexham", aliases: null, league_name: null, source_url: "https://www.wrexhamafc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  // ── League One (season_division_id: 3) ──────────────────────
      { id: 45, name: "AFC Wimbledon", aliases: null, league_name: null, source_url: "https://www.afcwimbledon.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 46, name: "Barnsley", aliases: null, league_name: null, source_url: "https://www.barnsleyfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 47, name: "Blackpool", aliases: null, league_name: null, source_url: "https://www.blackpoolfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 48, name: "Bolton Wanderers", aliases: null, league_name: null, source_url: "https://www.bwfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 49, name: "Bradford City", aliases: null, league_name: null, source_url: "https://www.bradfordcityfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 50, name: "Burton Albion", aliases: null, league_name: null, source_url: "https://www.burtonalbionfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 51, name: "Cardiff City", aliases: null, league_name: null, source_url: "https://www.cardiffcityfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 52, name: "Doncaster Rovers", aliases: null, league_name: null, source_url: "https://www.doncasterroversfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 53, name: "Exeter City", aliases: null, league_name: null, source_url: "https://www.exetercityfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 54, name: "Huddersfield Town", aliases: null, league_name: null, source_url: "https://www.htafc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 55, name: "Leyton Orient", aliases: null, league_name: null, source_url: "https://www.leytonorient.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 56, name: "Lincoln City", aliases: null, league_name: null, source_url: "https://www.weareimps.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 57, name: "Luton Town", aliases: null, league_name: null, source_url: "https://www.lutontown.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 58, name: "Mansfield Town", aliases: null, league_name: null, source_url: "https://www.mansfieldtown.net/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 59, name: "Northampton Town", aliases: null, league_name: null, source_url: "https://www.ntfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 60, name: "Peterborough United", aliases: null, league_name: null, source_url: "https://www.theposh.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 61, name: "Plymouth Argyle", aliases: null, league_name: null, source_url: "https://www.pafc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 62, name: "Port Vale", aliases: null, league_name: null, source_url: "https://www.port-vale.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 63, name: "Reading", aliases: null, league_name: null, source_url: "https://www.readingfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 64, name: "Rotherham United", aliases: null, league_name: null, source_url: "https://www.themillers.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 65, name: "Stevenage", aliases: null, league_name: null, source_url: "https://www.stevenagefc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 66, name: "Stockport County", aliases: null, league_name: null, source_url: "https://www.stockportcounty.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 67, name: "Wigan Athletic", aliases: null, league_name: null, source_url: "https://wiganathletic.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 68, name: "Wycombe Wanderers", aliases: null, league_name: null, source_url: "https://www.wwfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  // ── League Two (season_division_id: 4) ──────────────────────
      { id: 69, name: "Accrington Stanley", aliases: null, league_name: null, source_url: "https://www.accringtonstanley.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 70, name: "Barnet", aliases: null, league_name: null, source_url: "https://www.barnetfc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 71, name: "Barrow", aliases: null, league_name: null, source_url: "https://www.barrowafc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 72, name: "Bristol Rovers", aliases: null, league_name: null, source_url: "https://www.bristolrovers.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 73, name: "Bromley", aliases: null, league_name: null, source_url: "https://www.bromleyfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 74, name: "Cambridge United", aliases: null, league_name: null, source_url: "https://www.cambridgeunited.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 75, name: "Cheltenham Town", aliases: null, league_name: null, source_url: "https://www.ctfc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 76, name: "Chesterfield", aliases: null, league_name: null, source_url: "https://www.chesterfieldfc.net/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 77, name: "Colchester United", aliases: null, league_name: null, source_url: "https://www.colchesterunited.net/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 78, name: "Crawley Town", aliases: null, league_name: null, source_url: "https://www.crawleytownfc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 79, name: "Crewe Alexandra", aliases: null, league_name: null, source_url: "https://www.crewealex.net/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 80, name: "Fleetwood Town", aliases: null, league_name: null, source_url: "https://www.fleetwoodtownfc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 81, name: "Gillingham", aliases: null, league_name: null, source_url: "https://www.gillinghamfootballclub.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 82, name: "Grimsby Town", aliases: null, league_name: null, source_url: "https://www.grimsby-townfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 83, name: "Harrogate Town", aliases: null, league_name: null, source_url: "https://www.harrogatetownafc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 84, name: "Milton Keynes Dons", aliases: null, league_name: null, source_url: "https://www.mkdons.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 85, name: "Newport County", aliases: null, league_name: null, source_url: "https://www.newport-county.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 86, name: "Notts County", aliases: null, league_name: null, source_url: "https://www.nottscountyfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 87, name: "Oldham Athletic", aliases: null, league_name: null, source_url: "https://www.oldhamathletic.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 88, name: "Salford City", aliases: null, league_name: null, source_url: "https://www.salfordcityfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 89, name: "Shrewsbury Town", aliases: null, league_name: null, source_url: "https://www.shrewsburytown.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 90, name: "Swindon Town", aliases: null, league_name: null, source_url: "https://www.swindontownfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 91, name: "Tranmere Rovers", aliases: null, league_name: null, source_url: "https://www.tranmererovers.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 92, name: "Walsall", aliases: null, league_name: null, source_url: "https://www.saddlers.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  // ── National League (season_division_id: 5) ──────────────────────
      { id: 93, name: "Aldershot Town", aliases: null, league_name: null, source_url: "https://www.theshots.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 94, name: "Altrincham", aliases: null, league_name: null, source_url: "https://www.altrinchamfc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 95, name: "Boreham Wood", aliases: null, league_name: null, source_url: "https://www.borehamwoodfootballclub.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 96, name: "Boston United", aliases: null, league_name: null, source_url: "https://www.bostonunited.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 97, name: "Brackley Town", aliases: null, league_name: null, source_url: "https://www.brackleytownfc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 98, name: "Braintree Town", aliases: null, league_name: null, source_url: "https://www.braintreetownfc.org.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 99, name: "Carlisle United", aliases: null, league_name: null, source_url: "https://www.carlisleunited.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 100, name: "Eastleigh", aliases: null, league_name: null, source_url: "https://www.eastleighfc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 101, name: "FC Halifax Town", aliases: null, league_name: null, source_url: "https://www.fchalifaxtown.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 102, name: "Forest Green Rovers", aliases: null, league_name: null, source_url: "https://www.fgr.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 103, name: "Gateshead", aliases: null, league_name: null, source_url: "https://www.gateshead-fc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 104, name: "Hartlepool United", aliases: null, league_name: null, source_url: "https://www.hartlepoolunited.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 105, name: "Morecambe", aliases: null, league_name: null, source_url: "https://www.morecambefc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 106, name: "Rochdale", aliases: null, league_name: null, source_url: "https://www.rochdaleafc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 107, name: "Scunthorpe United", aliases: null, league_name: null, source_url: "https://www.scunthorpe-united.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 108, name: "Solihull Moors", aliases: null, league_name: null, source_url: "https://www.solihullmoorsfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 109, name: "Southend United", aliases: null, league_name: null, source_url: "https://www.southendunited.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 110, name: "Sutton United", aliases: null, league_name: null, source_url: "https://www.suttonunited.net/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 111, name: "Tamworth", aliases: null, league_name: null, source_url: "https://www.tamworthfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 112, name: "Truro City", aliases: null, league_name: null, source_url: "https://www.trurocityfc.net/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 113, name: "Wealdstone", aliases: null, league_name: null, source_url: "https://www.wealdstone-fc.com/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 114, name: "Woking", aliases: null, league_name: null, source_url: "https://www.wokingfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 115, name: "Yeovil Town", aliases: null, league_name: null, source_url: "https://www.ytfc.net/tickets", verified_at: "2026-05-15", status: "known" },
      { id: 116, name: "York City", aliases: null, league_name: null, source_url: "https://www.yorkcityfootballclub.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  // ── National League North (season_division_id: 6) ─────────────
  { id: 117, name: "AFC Fylde", aliases: null, league_name: null, source_url: "https://www.afcfylde.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 118, name: "AFC Telford United", aliases: null, league_name: null, source_url: "https://www.telfordunited.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 119, name: "Alfreton Town", aliases: null, league_name: null, source_url: "https://www.alfretontownfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 120, name: "Bedford Town", aliases: null, league_name: null, source_url: "https://www.bedfordtownfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 121, name: "Buxton", aliases: null, league_name: null, source_url: "https://www.buxtonfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 122, name: "Chester", aliases: null, league_name: null, source_url: "https://www.chesterfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 123, name: "Chorley", aliases: null, league_name: null, source_url: "https://www.chorleyfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 124, name: "Curzon Ashton", aliases: null, league_name: null, source_url: "https://www.curzonashtonfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 125, name: "Darlington", aliases: null, league_name: null, source_url: "https://www.darlingtonfc.org/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 126, name: "Hereford", aliases: null, league_name: null, source_url: "https://www.herefordfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 127, name: "Kidderminster Harriers", aliases: null, league_name: null, source_url: "https://www.harriers.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 128, name: "King's Lynn Town", aliases: null, league_name: null, source_url: "https://www.kltown.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 129, name: "Leamington", aliases: null, league_name: null, source_url: "https://www.leamingtonfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 130, name: "Macclesfield", aliases: null, league_name: null, source_url: "https://www.macclesfieldfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 131, name: "Marine", aliases: null, league_name: null, source_url: "https://www.marinefc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 132, name: "Merthyr Town", aliases: null, league_name: null, source_url: "https://www.merthyrtownfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 133, name: "Oxford City", aliases: null, league_name: null, source_url: "https://www.oxfordcityfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 134, name: "Peterborough Sports", aliases: null, league_name: null, source_url: "https://www.peterboroughsportsfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 135, name: "Radcliffe", aliases: null, league_name: null, source_url: "https://www.radcliffefc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 136, name: "Scarborough Athletic", aliases: null, league_name: null, source_url: "https://www.scarboroughathletic.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 137, name: "South Shields", aliases: null, league_name: null, source_url: "https://www.southshieldsfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 138, name: "Southport", aliases: null, league_name: null, source_url: "https://www.southportfc.net/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 139, name: "Spennymoor Town", aliases: null, league_name: null, source_url: "https://www.spennymoortownfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 140, name: "Worksop Town", aliases: null, league_name: null, source_url: "https://www.worksoptownfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  // ── National League South (season_division_id: 7) ─────────────
  { id: 141, name: "AFC Totton", aliases: null, league_name: null, source_url: "https://www.afctotton.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 142, name: "Bath City", aliases: null, league_name: null, source_url: "https://www.bathcityfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 143, name: "Chelmsford City", aliases: null, league_name: null, source_url: "https://www.chelmsfordcityfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 144, name: "Chesham United", aliases: null, league_name: null, source_url: "https://www.cheshamunitedfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 145, name: "Chippenham Town", aliases: null, league_name: null, source_url: "https://www.chippenhamtownfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 146, name: "Dagenham & Redbridge", aliases: null, league_name: null, source_url: "https://www.daggers.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 147, name: "Dorking Wanderers", aliases: null, league_name: null, source_url: "https://www.dorkingwanderers.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 148, name: "Dover Athletic", aliases: null, league_name: null, source_url: "https://www.doverathletic.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 149, name: "Eastbourne Borough", aliases: null, league_name: null, source_url: "https://www.ebfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 150, name: "Ebbsfleet United", aliases: null, league_name: null, source_url: "https://www.ebbsfleetunited.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 151, name: "Enfield Town", aliases: null, league_name: null, source_url: "https://www.enfieldtownfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 152, name: "Farnborough", aliases: null, league_name: null, source_url: "https://www.farnboroughfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 153, name: "Hampton & Richmond Borough", aliases: null, league_name: null, source_url: "https://www.hamptonfc.net/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 154, name: "Hemel Hempstead Town", aliases: null, league_name: null, source_url: "https://www.hemelfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 155, name: "Hornchurch", aliases: null, league_name: null, source_url: "https://www.hornchurchfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 156, name: "Horsham", aliases: null, league_name: null, source_url: "https://www.horshamfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 157, name: "Maidenhead United", aliases: null, league_name: null, source_url: "https://www.maidenheadunitedfc.org/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 158, name: "Maidstone United", aliases: null, league_name: null, source_url: "https://www.maidstoneunited.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 159, name: "Salisbury", aliases: null, league_name: null, source_url: "https://www.salisburyfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 160, name: "Slough Town", aliases: null, league_name: null, source_url: "https://www.sloughtownfc.net/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 161, name: "Tonbridge Angels", aliases: null, league_name: null, source_url: "https://www.tonbridgeangels.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 162, name: "Torquay United", aliases: null, league_name: null, source_url: "https://www.torquayunited.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 163, name: "Weston-super-Mare", aliases: null, league_name: null, source_url: "https://www.westonsupermarefc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 164, name: "Worthing", aliases: null, league_name: null, source_url: "https://www.worthingfc.com/tickets", verified_at: "2026-05-15", status: "known" },


  // ── NWCFL Premier Division (season_division_id: 12) ──
  { id: 165, name: "Abbey Hey", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 166, name: "AFC Liverpool", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 167, name: "Atherton Laburnum Rovers", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 168, name: "Barnoldswick Town", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 169, name: "Burscough", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 170, name: "Chadderton", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 171, name: "Charnock Richard", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 172, name: "Cheadle Town", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 173, name: "City of Liverpool", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 174, name: "Euxton Villa", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 175, name: "FC Isle of Man", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 176, name: "FC St Helens", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 177, name: "Glossop North End", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 178, name: "Irlam", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 179, name: "Litherland REMYCA", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 180, name: "Longridge Town", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 181, name: "Padiham", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 182, name: "Pilkington", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 183, name: "Prestwich Heys", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 184, name: "Ramsbottom United", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 185, name: "South Liverpool", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 186, name: "Stockport Town", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 187, name: "West Didsbury & Chorlton", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 188, name: "Wythenshawe", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  // ── NWCFL Division One North (season_division_id: 13) ──
  { id: 189, name: "AFC Blackpool", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 190, name: "Ashton Athletic", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 191, name: "Ashton Town", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 192, name: "Bacup Borough", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 193, name: "Cheadle Heath Nomads", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 194, name: "Colne", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 195, name: "Daisy Hill", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 196, name: "Darwen", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 197, name: "Droylsden", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 198, name: "Fulwood Amateurs", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 199, name: "Garstang", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 200, name: "Holker Old Boys", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 201, name: "Maghull", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 202, name: "Maine Road", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 203, name: "Nelson", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 204, name: "Squires Gate", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 205, name: "Steeton", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 206, name: "Thornton Cleveleys", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  // ── NWCFL Division One South (season_division_id: 14) ──
  { id: 207, name: "Allscott Heath", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 208, name: "Alsager Town", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 209, name: "Ashville", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 210, name: "Barnton", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 211, name: "Cammell Laird 1907", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 212, name: "Eccleshall", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 213, name: "Foley Meir", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 214, name: "Haughmond", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 215, name: "Market Drayton Town", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 216, name: "MSB Woolton", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 217, name: "New Mills", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 218, name: "Runcorn Town", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 219, name: "Sandbach United", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 220, name: "Shawbury United", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 221, name: "Stafford Town", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 222, name: "Stockport Georgians", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 223, name: "Telford Town", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 224, name: "Wolverhampton Casuals", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
  { id: 225, name: "Wolverhampton Sporting Community", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },
];
export const MEN_PYRAMID_MEMBERSHIPS: PyramidMembershipRow[] = [
  // Premier League (season_division_id: 1)
  { id: 1, season_id: 1, template_id: 1, season_division_id: 1, club_id: 1 },
  { id: 2, season_id: 1, template_id: 1, season_division_id: 1, club_id: 2 },
  { id: 3, season_id: 1, template_id: 1, season_division_id: 1, club_id: 3 },
  { id: 4, season_id: 1, template_id: 1, season_division_id: 1, club_id: 4 },
  { id: 5, season_id: 1, template_id: 1, season_division_id: 1, club_id: 5 },
  { id: 6, season_id: 1, template_id: 1, season_division_id: 1, club_id: 6 },
  { id: 7, season_id: 1, template_id: 1, season_division_id: 1, club_id: 7 },
  { id: 8, season_id: 1, template_id: 1, season_division_id: 1, club_id: 8 },
  { id: 9, season_id: 1, template_id: 1, season_division_id: 1, club_id: 9 },
  { id: 10, season_id: 1, template_id: 1, season_division_id: 1, club_id: 10 },
  { id: 11, season_id: 1, template_id: 1, season_division_id: 1, club_id: 11 },
  { id: 12, season_id: 1, template_id: 1, season_division_id: 1, club_id: 12 },
  { id: 13, season_id: 1, template_id: 1, season_division_id: 1, club_id: 13 },
  { id: 14, season_id: 1, template_id: 1, season_division_id: 1, club_id: 14 },
  { id: 15, season_id: 1, template_id: 1, season_division_id: 1, club_id: 15 },
  { id: 16, season_id: 1, template_id: 1, season_division_id: 1, club_id: 16 },
  { id: 17, season_id: 1, template_id: 1, season_division_id: 1, club_id: 17 },
  { id: 18, season_id: 1, template_id: 1, season_division_id: 1, club_id: 18 },
  { id: 19, season_id: 1, template_id: 1, season_division_id: 1, club_id: 19 },
  { id: 20, season_id: 1, template_id: 1, season_division_id: 1, club_id: 20 },
  // Championship (season_division_id: 2)
  { id: 21, season_id: 1, template_id: 1, season_division_id: 2, club_id: 21 },
  { id: 22, season_id: 1, template_id: 1, season_division_id: 2, club_id: 22 },
  { id: 23, season_id: 1, template_id: 1, season_division_id: 2, club_id: 23 },
  { id: 24, season_id: 1, template_id: 1, season_division_id: 2, club_id: 24 },
  { id: 25, season_id: 1, template_id: 1, season_division_id: 2, club_id: 25 },
  { id: 26, season_id: 1, template_id: 1, season_division_id: 2, club_id: 26 },
  { id: 27, season_id: 1, template_id: 1, season_division_id: 2, club_id: 27 },
  { id: 28, season_id: 1, template_id: 1, season_division_id: 2, club_id: 28 },
  { id: 29, season_id: 1, template_id: 1, season_division_id: 2, club_id: 29 },
  { id: 30, season_id: 1, template_id: 1, season_division_id: 2, club_id: 30 },
  { id: 31, season_id: 1, template_id: 1, season_division_id: 2, club_id: 31 },
  { id: 32, season_id: 1, template_id: 1, season_division_id: 2, club_id: 32 },
  { id: 33, season_id: 1, template_id: 1, season_division_id: 2, club_id: 33 },
  { id: 34, season_id: 1, template_id: 1, season_division_id: 2, club_id: 34 },
  { id: 35, season_id: 1, template_id: 1, season_division_id: 2, club_id: 35 },
  { id: 36, season_id: 1, template_id: 1, season_division_id: 2, club_id: 36 },
  { id: 37, season_id: 1, template_id: 1, season_division_id: 2, club_id: 37 },
  { id: 38, season_id: 1, template_id: 1, season_division_id: 2, club_id: 38 },
  { id: 39, season_id: 1, template_id: 1, season_division_id: 2, club_id: 39 },
  { id: 40, season_id: 1, template_id: 1, season_division_id: 2, club_id: 40 },
  { id: 41, season_id: 1, template_id: 1, season_division_id: 2, club_id: 41 },
  { id: 42, season_id: 1, template_id: 1, season_division_id: 2, club_id: 42 },
  { id: 43, season_id: 1, template_id: 1, season_division_id: 2, club_id: 43 },
  { id: 44, season_id: 1, template_id: 1, season_division_id: 2, club_id: 44 },
  // League One (season_division_id: 3)
  { id: 45, season_id: 1, template_id: 1, season_division_id: 3, club_id: 45 },
  { id: 46, season_id: 1, template_id: 1, season_division_id: 3, club_id: 46 },
  { id: 47, season_id: 1, template_id: 1, season_division_id: 3, club_id: 47 },
  { id: 48, season_id: 1, template_id: 1, season_division_id: 3, club_id: 48 },
  { id: 49, season_id: 1, template_id: 1, season_division_id: 3, club_id: 49 },
  { id: 50, season_id: 1, template_id: 1, season_division_id: 3, club_id: 50 },
  { id: 51, season_id: 1, template_id: 1, season_division_id: 3, club_id: 51 },
  { id: 52, season_id: 1, template_id: 1, season_division_id: 3, club_id: 52 },
  { id: 53, season_id: 1, template_id: 1, season_division_id: 3, club_id: 53 },
  { id: 54, season_id: 1, template_id: 1, season_division_id: 3, club_id: 54 },
  { id: 55, season_id: 1, template_id: 1, season_division_id: 3, club_id: 55 },
  { id: 56, season_id: 1, template_id: 1, season_division_id: 3, club_id: 56 },
  { id: 57, season_id: 1, template_id: 1, season_division_id: 3, club_id: 57 },
  { id: 58, season_id: 1, template_id: 1, season_division_id: 3, club_id: 58 },
  { id: 59, season_id: 1, template_id: 1, season_division_id: 3, club_id: 59 },
  { id: 60, season_id: 1, template_id: 1, season_division_id: 3, club_id: 60 },
  { id: 61, season_id: 1, template_id: 1, season_division_id: 3, club_id: 61 },
  { id: 62, season_id: 1, template_id: 1, season_division_id: 3, club_id: 62 },
  { id: 63, season_id: 1, template_id: 1, season_division_id: 3, club_id: 63 },
  { id: 64, season_id: 1, template_id: 1, season_division_id: 3, club_id: 64 },
  { id: 65, season_id: 1, template_id: 1, season_division_id: 3, club_id: 65 },
  { id: 66, season_id: 1, template_id: 1, season_division_id: 3, club_id: 66 },
  { id: 67, season_id: 1, template_id: 1, season_division_id: 3, club_id: 67 },
  { id: 68, season_id: 1, template_id: 1, season_division_id: 3, club_id: 68 },
  // League Two (season_division_id: 4)
  { id: 69, season_id: 1, template_id: 1, season_division_id: 4, club_id: 69 },
  { id: 70, season_id: 1, template_id: 1, season_division_id: 4, club_id: 70 },
  { id: 71, season_id: 1, template_id: 1, season_division_id: 4, club_id: 71 },
  { id: 72, season_id: 1, template_id: 1, season_division_id: 4, club_id: 72 },
  { id: 73, season_id: 1, template_id: 1, season_division_id: 4, club_id: 73 },
  { id: 74, season_id: 1, template_id: 1, season_division_id: 4, club_id: 74 },
  { id: 75, season_id: 1, template_id: 1, season_division_id: 4, club_id: 75 },
  { id: 76, season_id: 1, template_id: 1, season_division_id: 4, club_id: 76 },
  { id: 77, season_id: 1, template_id: 1, season_division_id: 4, club_id: 77 },
  { id: 78, season_id: 1, template_id: 1, season_division_id: 4, club_id: 78 },
  { id: 79, season_id: 1, template_id: 1, season_division_id: 4, club_id: 79 },
  { id: 80, season_id: 1, template_id: 1, season_division_id: 4, club_id: 80 },
  { id: 81, season_id: 1, template_id: 1, season_division_id: 4, club_id: 81 },
  { id: 82, season_id: 1, template_id: 1, season_division_id: 4, club_id: 82 },
  { id: 83, season_id: 1, template_id: 1, season_division_id: 4, club_id: 83 },
  { id: 84, season_id: 1, template_id: 1, season_division_id: 4, club_id: 84 },
  { id: 85, season_id: 1, template_id: 1, season_division_id: 4, club_id: 85 },
  { id: 86, season_id: 1, template_id: 1, season_division_id: 4, club_id: 86 },
  { id: 87, season_id: 1, template_id: 1, season_division_id: 4, club_id: 87 },
  { id: 88, season_id: 1, template_id: 1, season_division_id: 4, club_id: 88 },
  { id: 89, season_id: 1, template_id: 1, season_division_id: 4, club_id: 89 },
  { id: 90, season_id: 1, template_id: 1, season_division_id: 4, club_id: 90 },
  { id: 91, season_id: 1, template_id: 1, season_division_id: 4, club_id: 91 },
  { id: 92, season_id: 1, template_id: 1, season_division_id: 4, club_id: 92 },
  // National League (season_division_id: 5)
  { id: 93, season_id: 1, template_id: 1, season_division_id: 5, club_id: 93 },
  { id: 94, season_id: 1, template_id: 1, season_division_id: 5, club_id: 94 },
  { id: 95, season_id: 1, template_id: 1, season_division_id: 5, club_id: 95 },
  { id: 96, season_id: 1, template_id: 1, season_division_id: 5, club_id: 96 },
  { id: 97, season_id: 1, template_id: 1, season_division_id: 5, club_id: 97 },
  { id: 98, season_id: 1, template_id: 1, season_division_id: 5, club_id: 98 },
  { id: 99, season_id: 1, template_id: 1, season_division_id: 5, club_id: 99 },
  { id: 100, season_id: 1, template_id: 1, season_division_id: 5, club_id: 100 },
  { id: 101, season_id: 1, template_id: 1, season_division_id: 5, club_id: 101 },
  { id: 102, season_id: 1, template_id: 1, season_division_id: 5, club_id: 102 },
  { id: 103, season_id: 1, template_id: 1, season_division_id: 5, club_id: 103 },
  { id: 104, season_id: 1, template_id: 1, season_division_id: 5, club_id: 104 },
  { id: 105, season_id: 1, template_id: 1, season_division_id: 5, club_id: 105 },
  { id: 106, season_id: 1, template_id: 1, season_division_id: 5, club_id: 106 },
  { id: 107, season_id: 1, template_id: 1, season_division_id: 5, club_id: 107 },
  { id: 108, season_id: 1, template_id: 1, season_division_id: 5, club_id: 108 },
  { id: 109, season_id: 1, template_id: 1, season_division_id: 5, club_id: 109 },
  { id: 110, season_id: 1, template_id: 1, season_division_id: 5, club_id: 110 },
  { id: 111, season_id: 1, template_id: 1, season_division_id: 5, club_id: 111 },
  { id: 112, season_id: 1, template_id: 1, season_division_id: 5, club_id: 112 },
  { id: 113, season_id: 1, template_id: 1, season_division_id: 5, club_id: 113 },
  { id: 114, season_id: 1, template_id: 1, season_division_id: 5, club_id: 114 },
  { id: 115, season_id: 1, template_id: 1, season_division_id: 5, club_id: 115 },
  { id: 116, season_id: 1, template_id: 1, season_division_id: 5, club_id: 116 },

  { id: 117, season_id: 1, template_id: 1, season_division_id: 6, club_id: 117 },
  { id: 118, season_id: 1, template_id: 1, season_division_id: 6, club_id: 118 },
  { id: 119, season_id: 1, template_id: 1, season_division_id: 6, club_id: 119 },
  { id: 120, season_id: 1, template_id: 1, season_division_id: 6, club_id: 120 },
  { id: 121, season_id: 1, template_id: 1, season_division_id: 6, club_id: 121 },
  { id: 122, season_id: 1, template_id: 1, season_division_id: 6, club_id: 122 },
  { id: 123, season_id: 1, template_id: 1, season_division_id: 6, club_id: 123 },
  { id: 124, season_id: 1, template_id: 1, season_division_id: 6, club_id: 124 },
  { id: 125, season_id: 1, template_id: 1, season_division_id: 6, club_id: 125 },
  { id: 126, season_id: 1, template_id: 1, season_division_id: 6, club_id: 126 },
  { id: 127, season_id: 1, template_id: 1, season_division_id: 6, club_id: 127 },
  { id: 128, season_id: 1, template_id: 1, season_division_id: 6, club_id: 128 },
  { id: 129, season_id: 1, template_id: 1, season_division_id: 6, club_id: 129 },
  { id: 130, season_id: 1, template_id: 1, season_division_id: 6, club_id: 130 },
  { id: 131, season_id: 1, template_id: 1, season_division_id: 6, club_id: 131 },
  { id: 132, season_id: 1, template_id: 1, season_division_id: 6, club_id: 132 },
  { id: 133, season_id: 1, template_id: 1, season_division_id: 6, club_id: 133 },
  { id: 134, season_id: 1, template_id: 1, season_division_id: 6, club_id: 134 },
  { id: 135, season_id: 1, template_id: 1, season_division_id: 6, club_id: 135 },
  { id: 136, season_id: 1, template_id: 1, season_division_id: 6, club_id: 136 },
  { id: 137, season_id: 1, template_id: 1, season_division_id: 6, club_id: 137 },
  { id: 138, season_id: 1, template_id: 1, season_division_id: 6, club_id: 138 },
  { id: 139, season_id: 1, template_id: 1, season_division_id: 6, club_id: 139 },
  { id: 140, season_id: 1, template_id: 1, season_division_id: 6, club_id: 140 },
  { id: 141, season_id: 1, template_id: 1, season_division_id: 7, club_id: 141 },
  { id: 142, season_id: 1, template_id: 1, season_division_id: 7, club_id: 142 },
  { id: 143, season_id: 1, template_id: 1, season_division_id: 7, club_id: 143 },
  { id: 144, season_id: 1, template_id: 1, season_division_id: 7, club_id: 144 },
  { id: 145, season_id: 1, template_id: 1, season_division_id: 7, club_id: 145 },
  { id: 146, season_id: 1, template_id: 1, season_division_id: 7, club_id: 146 },
  { id: 147, season_id: 1, template_id: 1, season_division_id: 7, club_id: 147 },
  { id: 148, season_id: 1, template_id: 1, season_division_id: 7, club_id: 148 },
  { id: 149, season_id: 1, template_id: 1, season_division_id: 7, club_id: 149 },
  { id: 150, season_id: 1, template_id: 1, season_division_id: 7, club_id: 150 },
  { id: 151, season_id: 1, template_id: 1, season_division_id: 7, club_id: 151 },
  { id: 152, season_id: 1, template_id: 1, season_division_id: 7, club_id: 152 },
  { id: 153, season_id: 1, template_id: 1, season_division_id: 7, club_id: 153 },
  { id: 154, season_id: 1, template_id: 1, season_division_id: 7, club_id: 154 },
  { id: 155, season_id: 1, template_id: 1, season_division_id: 7, club_id: 155 },
  { id: 156, season_id: 1, template_id: 1, season_division_id: 7, club_id: 156 },
  { id: 157, season_id: 1, template_id: 1, season_division_id: 7, club_id: 157 },
  { id: 158, season_id: 1, template_id: 1, season_division_id: 7, club_id: 158 },
  { id: 159, season_id: 1, template_id: 1, season_division_id: 7, club_id: 159 },
  { id: 160, season_id: 1, template_id: 1, season_division_id: 7, club_id: 160 },
  { id: 161, season_id: 1, template_id: 1, season_division_id: 7, club_id: 161 },
  { id: 162, season_id: 1, template_id: 1, season_division_id: 7, club_id: 162 },
  { id: 163, season_id: 1, template_id: 1, season_division_id: 7, club_id: 163 },
  { id: 164, season_id: 1, template_id: 1, season_division_id: 7, club_id: 164 },

  { id: 165, season_id: 1, template_id: 1, season_division_id: 12, club_id: 165 },
  { id: 166, season_id: 1, template_id: 1, season_division_id: 12, club_id: 166 },
  { id: 167, season_id: 1, template_id: 1, season_division_id: 12, club_id: 167 },
  { id: 168, season_id: 1, template_id: 1, season_division_id: 12, club_id: 168 },
  { id: 169, season_id: 1, template_id: 1, season_division_id: 12, club_id: 169 },
  { id: 170, season_id: 1, template_id: 1, season_division_id: 12, club_id: 170 },
  { id: 171, season_id: 1, template_id: 1, season_division_id: 12, club_id: 171 },
  { id: 172, season_id: 1, template_id: 1, season_division_id: 12, club_id: 172 },
  { id: 173, season_id: 1, template_id: 1, season_division_id: 12, club_id: 173 },
  { id: 174, season_id: 1, template_id: 1, season_division_id: 12, club_id: 174 },
  { id: 175, season_id: 1, template_id: 1, season_division_id: 12, club_id: 175 },
  { id: 176, season_id: 1, template_id: 1, season_division_id: 12, club_id: 176 },
  { id: 177, season_id: 1, template_id: 1, season_division_id: 12, club_id: 177 },
  { id: 178, season_id: 1, template_id: 1, season_division_id: 12, club_id: 178 },
  { id: 179, season_id: 1, template_id: 1, season_division_id: 12, club_id: 179 },
  { id: 180, season_id: 1, template_id: 1, season_division_id: 12, club_id: 180 },
  { id: 181, season_id: 1, template_id: 1, season_division_id: 12, club_id: 181 },
  { id: 182, season_id: 1, template_id: 1, season_division_id: 12, club_id: 182 },
  { id: 183, season_id: 1, template_id: 1, season_division_id: 12, club_id: 183 },
  { id: 184, season_id: 1, template_id: 1, season_division_id: 12, club_id: 184 },
  { id: 185, season_id: 1, template_id: 1, season_division_id: 12, club_id: 185 },
  { id: 186, season_id: 1, template_id: 1, season_division_id: 12, club_id: 186 },
  { id: 187, season_id: 1, template_id: 1, season_division_id: 12, club_id: 187 },
  { id: 188, season_id: 1, template_id: 1, season_division_id: 12, club_id: 188 },
  { id: 189, season_id: 1, template_id: 1, season_division_id: 13, club_id: 189 },
  { id: 190, season_id: 1, template_id: 1, season_division_id: 13, club_id: 190 },
  { id: 191, season_id: 1, template_id: 1, season_division_id: 13, club_id: 191 },
  { id: 192, season_id: 1, template_id: 1, season_division_id: 13, club_id: 192 },
  { id: 193, season_id: 1, template_id: 1, season_division_id: 13, club_id: 193 },
  { id: 194, season_id: 1, template_id: 1, season_division_id: 13, club_id: 194 },
  { id: 195, season_id: 1, template_id: 1, season_division_id: 13, club_id: 195 },
  { id: 196, season_id: 1, template_id: 1, season_division_id: 13, club_id: 196 },
  { id: 197, season_id: 1, template_id: 1, season_division_id: 13, club_id: 197 },
  { id: 198, season_id: 1, template_id: 1, season_division_id: 13, club_id: 198 },
  { id: 199, season_id: 1, template_id: 1, season_division_id: 13, club_id: 199 },
  { id: 200, season_id: 1, template_id: 1, season_division_id: 13, club_id: 200 },
  { id: 201, season_id: 1, template_id: 1, season_division_id: 13, club_id: 201 },
  { id: 202, season_id: 1, template_id: 1, season_division_id: 13, club_id: 202 },
  { id: 203, season_id: 1, template_id: 1, season_division_id: 13, club_id: 203 },
  { id: 204, season_id: 1, template_id: 1, season_division_id: 13, club_id: 204 },
  { id: 205, season_id: 1, template_id: 1, season_division_id: 13, club_id: 205 },
  { id: 206, season_id: 1, template_id: 1, season_division_id: 13, club_id: 206 },
  { id: 207, season_id: 1, template_id: 1, season_division_id: 14, club_id: 207 },
  { id: 208, season_id: 1, template_id: 1, season_division_id: 14, club_id: 208 },
  { id: 209, season_id: 1, template_id: 1, season_division_id: 14, club_id: 209 },
  { id: 210, season_id: 1, template_id: 1, season_division_id: 14, club_id: 210 },
  { id: 211, season_id: 1, template_id: 1, season_division_id: 14, club_id: 211 },
  { id: 212, season_id: 1, template_id: 1, season_division_id: 14, club_id: 212 },
  { id: 213, season_id: 1, template_id: 1, season_division_id: 14, club_id: 213 },
  { id: 214, season_id: 1, template_id: 1, season_division_id: 14, club_id: 214 },
  { id: 215, season_id: 1, template_id: 1, season_division_id: 14, club_id: 215 },
  { id: 216, season_id: 1, template_id: 1, season_division_id: 14, club_id: 216 },
  { id: 217, season_id: 1, template_id: 1, season_division_id: 14, club_id: 217 },
  { id: 218, season_id: 1, template_id: 1, season_division_id: 14, club_id: 218 },
  { id: 219, season_id: 1, template_id: 1, season_division_id: 14, club_id: 219 },
  { id: 220, season_id: 1, template_id: 1, season_division_id: 14, club_id: 220 },
  { id: 221, season_id: 1, template_id: 1, season_division_id: 14, club_id: 221 },
  { id: 222, season_id: 1, template_id: 1, season_division_id: 14, club_id: 222 },
  { id: 223, season_id: 1, template_id: 1, season_division_id: 14, club_id: 223 },
  { id: 224, season_id: 1, template_id: 1, season_division_id: 14, club_id: 224 },
  { id: 225, season_id: 1, template_id: 1, season_division_id: 14, club_id: 225 },
];
export const MEN_PYRAMID_MOVEMENTS: PyramidMovementRow[] = [];

export const CLUB_VENUE_ASSIGNMENTS: ClubVenueAssignmentRow[] = [
  { id: 1, club_id: 1, venue_id: 3, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 2, club_id: 2, venue_id: 7, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 3, club_id: 3, venue_id: 8, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 4, club_id: 4, venue_id: 9, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 5, club_id: 5, venue_id: 10, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 6, club_id: 6, venue_id: 11, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 7, club_id: 7, venue_id: 1, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 8, club_id: 8, venue_id: 12, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 9, club_id: 9, venue_id: 13, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 10, club_id: 10, venue_id: 14, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 11, club_id: 11, venue_id: 15, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 12, club_id: 12, venue_id: 16, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 13, club_id: 13, venue_id: 17, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 14, club_id: 14, venue_id: 4, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 15, club_id: 15, venue_id: 18, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 16, club_id: 16, venue_id: 19, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 17, club_id: 17, venue_id: 20, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 18, club_id: 18, venue_id: 21, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 19, club_id: 19, venue_id: 22, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 20, club_id: 20, venue_id: 23, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 21, club_id: 21, venue_id: 6, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 22, club_id: 22, venue_id: 24, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 23, club_id: 23, venue_id: 25, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 24, club_id: 24, venue_id: 26, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 25, club_id: 25, venue_id: 27, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 26, club_id: 26, venue_id: 28, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 27, club_id: 27, venue_id: 29, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 28, club_id: 28, venue_id: 30, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 29, club_id: 29, venue_id: 31, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 30, club_id: 30, venue_id: 32, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 31, club_id: 31, venue_id: 33, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 32, club_id: 32, venue_id: 5, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 33, club_id: 33, venue_id: 34, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 34, club_id: 34, venue_id: 35, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 35, club_id: 35, venue_id: 36, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 36, club_id: 36, venue_id: 2, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 37, club_id: 37, venue_id: 37, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 38, club_id: 38, venue_id: 38, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 39, club_id: 39, venue_id: 39, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 40, club_id: 40, venue_id: 40, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 41, club_id: 41, venue_id: 41, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 42, club_id: 42, venue_id: 42, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 43, club_id: 43, venue_id: 43, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 44, club_id: 44, venue_id: 44, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 45, club_id: 45, venue_id: 45, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 46, club_id: 46, venue_id: 46, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 47, club_id: 47, venue_id: 47, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 48, club_id: 48, venue_id: 48, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 49, club_id: 49, venue_id: 49, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 50, club_id: 50, venue_id: 50, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 51, club_id: 51, venue_id: 51, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 52, club_id: 52, venue_id: 52, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 53, club_id: 53, venue_id: 53, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 54, club_id: 54, venue_id: 54, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 55, club_id: 55, venue_id: 55, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 56, club_id: 56, venue_id: 56, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 57, club_id: 57, venue_id: 57, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 58, club_id: 58, venue_id: 58, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 59, club_id: 59, venue_id: 59, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 60, club_id: 60, venue_id: 60, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 61, club_id: 61, venue_id: 61, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 62, club_id: 62, venue_id: 62, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 63, club_id: 63, venue_id: 63, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 64, club_id: 64, venue_id: 64, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 65, club_id: 65, venue_id: 65, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 66, club_id: 66, venue_id: 66, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 67, club_id: 67, venue_id: 67, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 68, club_id: 68, venue_id: 68, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 69, club_id: 69, venue_id: 69, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 70, club_id: 70, venue_id: 70, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 71, club_id: 71, venue_id: 71, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 72, club_id: 72, venue_id: 72, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 73, club_id: 73, venue_id: 73, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 74, club_id: 74, venue_id: 74, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 75, club_id: 75, venue_id: 75, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 76, club_id: 76, venue_id: 76, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 77, club_id: 77, venue_id: 77, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 78, club_id: 78, venue_id: 78, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 79, club_id: 79, venue_id: 79, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 80, club_id: 80, venue_id: 80, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 81, club_id: 81, venue_id: 81, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 82, club_id: 82, venue_id: 82, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 83, club_id: 83, venue_id: 83, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 84, club_id: 84, venue_id: 84, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 85, club_id: 85, venue_id: 85, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 86, club_id: 86, venue_id: 86, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 87, club_id: 87, venue_id: 87, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 88, club_id: 88, venue_id: 88, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 89, club_id: 89, venue_id: 89, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 90, club_id: 90, venue_id: 90, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 91, club_id: 91, venue_id: 91, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 92, club_id: 92, venue_id: 92, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 93, club_id: 93, venue_id: 93, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 94, club_id: 94, venue_id: 94, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 95, club_id: 95, venue_id: 95, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 96, club_id: 96, venue_id: 96, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 97, club_id: 97, venue_id: 97, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 98, club_id: 98, venue_id: 98, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 99, club_id: 99, venue_id: 99, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 100, club_id: 100, venue_id: 100, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 101, club_id: 101, venue_id: 101, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 102, club_id: 102, venue_id: 102, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 103, club_id: 103, venue_id: 103, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 104, club_id: 104, venue_id: 104, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 105, club_id: 105, venue_id: 105, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 106, club_id: 106, venue_id: 106, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 107, club_id: 107, venue_id: 107, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 108, club_id: 108, venue_id: 108, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 109, club_id: 109, venue_id: 109, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 110, club_id: 110, venue_id: 110, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 111, club_id: 111, venue_id: 111, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 112, club_id: 112, venue_id: 112, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 113, club_id: 113, venue_id: 113, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 114, club_id: 114, venue_id: 114, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 115, club_id: 115, venue_id: 115, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 116, club_id: 116, venue_id: 116, effective_from: "2025-08-01", effective_to: null, is_primary: 1 }, 

  { id: 117, club_id: 117, venue_id: 117, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 118, club_id: 118, venue_id: 118, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 119, club_id: 119, venue_id: 119, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 120, club_id: 120, venue_id: 120, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 121, club_id: 121, venue_id: 121, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 122, club_id: 122, venue_id: 122, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 123, club_id: 123, venue_id: 123, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 124, club_id: 124, venue_id: 124, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 125, club_id: 125, venue_id: 125, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 126, club_id: 126, venue_id: 126, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 127, club_id: 127, venue_id: 127, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 128, club_id: 128, venue_id: 128, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 129, club_id: 129, venue_id: 129, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 130, club_id: 130, venue_id: 130, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 131, club_id: 131, venue_id: 131, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 132, club_id: 132, venue_id: 132, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 133, club_id: 133, venue_id: 133, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 134, club_id: 134, venue_id: 134, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 135, club_id: 135, venue_id: 135, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 136, club_id: 136, venue_id: 136, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 137, club_id: 137, venue_id: 137, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 138, club_id: 138, venue_id: 138, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 139, club_id: 139, venue_id: 139, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 140, club_id: 140, venue_id: 140, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 141, club_id: 141, venue_id: 141, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 142, club_id: 142, venue_id: 142, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 143, club_id: 143, venue_id: 143, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 144, club_id: 144, venue_id: 144, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 145, club_id: 145, venue_id: 145, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 146, club_id: 146, venue_id: 146, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 147, club_id: 147, venue_id: 147, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 148, club_id: 148, venue_id: 148, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 149, club_id: 149, venue_id: 149, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 150, club_id: 150, venue_id: 150, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 151, club_id: 151, venue_id: 151, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 152, club_id: 152, venue_id: 152, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 153, club_id: 153, venue_id: 153, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 154, club_id: 154, venue_id: 154, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 155, club_id: 155, venue_id: 155, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 156, club_id: 156, venue_id: 156, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 157, club_id: 157, venue_id: 157, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 158, club_id: 158, venue_id: 158, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 159, club_id: 159, venue_id: 159, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 160, club_id: 160, venue_id: 160, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 161, club_id: 161, venue_id: 161, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 162, club_id: 162, venue_id: 162, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 163, club_id: 163, venue_id: 163, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 164, club_id: 164, venue_id: 164, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },

  { id: 165, club_id: 165, venue_id: 165, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 166, club_id: 166, venue_id: 166, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 167, club_id: 167, venue_id: 167, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 168, club_id: 168, venue_id: 168, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 169, club_id: 169, venue_id: 169, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 170, club_id: 170, venue_id: 170, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 171, club_id: 171, venue_id: 171, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 172, club_id: 172, venue_id: 172, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 173, club_id: 173, venue_id: 173, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 174, club_id: 174, venue_id: 174, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 175, club_id: 175, venue_id: 175, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 176, club_id: 176, venue_id: 176, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 177, club_id: 177, venue_id: 177, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 178, club_id: 178, venue_id: 178, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 179, club_id: 179, venue_id: 179, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 180, club_id: 180, venue_id: 180, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 181, club_id: 181, venue_id: 181, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 182, club_id: 182, venue_id: 182, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 183, club_id: 183, venue_id: 183, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 184, club_id: 184, venue_id: 184, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 185, club_id: 185, venue_id: 185, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 186, club_id: 186, venue_id: 186, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 187, club_id: 187, venue_id: 187, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 188, club_id: 188, venue_id: 188, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 189, club_id: 189, venue_id: 189, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 190, club_id: 190, venue_id: 190, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 191, club_id: 191, venue_id: 191, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 192, club_id: 192, venue_id: 192, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 193, club_id: 193, venue_id: 193, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 194, club_id: 194, venue_id: 194, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 195, club_id: 195, venue_id: 195, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 196, club_id: 196, venue_id: 196, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 197, club_id: 197, venue_id: 197, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 198, club_id: 198, venue_id: 198, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 199, club_id: 199, venue_id: 199, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 200, club_id: 200, venue_id: 200, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 201, club_id: 201, venue_id: 201, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 202, club_id: 202, venue_id: 202, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 203, club_id: 203, venue_id: 203, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 204, club_id: 204, venue_id: 204, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 205, club_id: 205, venue_id: 205, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 206, club_id: 206, venue_id: 206, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 207, club_id: 207, venue_id: 207, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 208, club_id: 208, venue_id: 208, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 209, club_id: 209, venue_id: 209, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 210, club_id: 210, venue_id: 210, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 211, club_id: 211, venue_id: 211, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 212, club_id: 212, venue_id: 212, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 213, club_id: 213, venue_id: 213, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 214, club_id: 214, venue_id: 214, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 215, club_id: 215, venue_id: 215, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 216, club_id: 216, venue_id: 216, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 217, club_id: 217, venue_id: 217, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 218, club_id: 218, venue_id: 218, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 219, club_id: 219, venue_id: 219, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 220, club_id: 220, venue_id: 220, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 221, club_id: 221, venue_id: 221, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 222, club_id: 222, venue_id: 222, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 223, club_id: 223, venue_id: 223, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 224, club_id: 224, venue_id: 224, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
  { id: 225, club_id: 225, venue_id: 225, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },
];
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
