import { describe, expect, it } from "vitest";

import {
  MEN_PYRAMID_DIVISIONS,
  MEN_PYRAMID_EDGES,
  MEN_PYRAMID_SEASON_DIVISIONS,
  validatePyramidSeason
} from "@/lib/db/pyramid";

describe("pyramid validation", () => {
  it("allows sparse open divisions", () => {
    const issues = validatePyramidSeason(
      MEN_PYRAMID_DIVISIONS,
      MEN_PYRAMID_SEASON_DIVISIONS.slice(0, 3),
      [
        { id: 1, season_id: 1, template_id: 1, season_division_id: 1, club_id: 10 },
        { id: 2, season_id: 1, template_id: 1, season_division_id: 2, club_id: 11 }
      ]
    );

    expect(issues).toEqual([]);
  });

  it("rejects duplicate clubs, overfilled divisions, and invalid movements", () => {
    const divisions = [
      { id: 1, template_id: 1, code: "alpha", name: "Alpha Division", level: 1, max_size: 2 },
      { id: 2, template_id: 1, code: "beta", name: "Beta Division", level: 2, max_size: 2 }
    ];

    const issues = validatePyramidSeason(
      divisions,
      [
        { id: 1, season_id: 1, template_id: 1, division_id: 1, status: "open", locked_at: null },
        { id: 2, season_id: 1, template_id: 1, division_id: 2, status: "open", locked_at: null }
      ],
      [
        { id: 1, season_id: 1, template_id: 1, season_division_id: 1, club_id: 10 },
        { id: 2, season_id: 1, template_id: 1, season_division_id: 2, club_id: 10 },
        { id: 3, season_id: 1, template_id: 1, season_division_id: 1, club_id: 11 },
        { id: 4, season_id: 1, template_id: 1, season_division_id: 1, club_id: 12 }
      ],
      [
        {
          id: 1,
          season_id: 1,
          template_id: 1,
          club_id: 10,
          from_season_division_id: 1,
          to_season_division_id: 2,
          movement_type: "promotion",
          note: null,
          created_at: "2026-05-10T00:00:00.000Z"
        }
      ]
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_club" }),
        expect.objectContaining({ code: "division_over_capacity" }),
        expect.objectContaining({ code: "invalid_movement" })
      ])
    );
  });

  it("reports memberships that reference unknown divisions", () => {
    const issues = validatePyramidSeason(
      MEN_PYRAMID_DIVISIONS,
      MEN_PYRAMID_SEASON_DIVISIONS.slice(0, 1),
      [
        { id: 1, season_id: 1, template_id: 1, season_division_id: 99, club_id: 10 }
      ]
    );

    expect(issues).toEqual([
      expect.objectContaining({ code: "unknown_season_division" })
    ]);
  });

  it("rejects movements for clubs that are not in the source division", () => {
    const issues = validatePyramidSeason(
      [
        { id: 1, template_id: 1, code: "alpha", name: "Alpha Division", level: 1, max_size: 2 },
        { id: 2, template_id: 1, code: "beta", name: "Beta Division", level: 2, max_size: 2 }
      ],
      [
        { id: 1, season_id: 1, template_id: 1, division_id: 1, status: "open", locked_at: null },
        { id: 2, season_id: 1, template_id: 1, division_id: 2, status: "open", locked_at: null }
      ],
      [
        { id: 1, season_id: 1, template_id: 1, season_division_id: 2, club_id: 10 }
      ],
      [
        {
          id: 1,
          season_id: 1,
          template_id: 1,
          club_id: 10,
          from_season_division_id: 1,
          to_season_division_id: 2,
          movement_type: "promotion",
          note: null,
          created_at: "2026-05-10T00:00:00.000Z"
        }
      ]
    );

    expect(issues).toEqual([
      expect.objectContaining({ code: "invalid_movement" })
    ]);
  });

  it("flags invalid season divisions even when they are empty", () => {
    const issues = validatePyramidSeason(
      [
        { id: 1, template_id: 1, code: "alpha", name: "Alpha Division", level: 1, max_size: 2 }
      ],
      [
        { id: 1, season_id: 1, template_id: 1, division_id: 999, status: "open", locked_at: null }
      ],
      []
    );

    expect(issues).toEqual([
      expect.objectContaining({ code: "season_template_mismatch" })
    ]);
  });

  it("every division below Level 1 has at least one promotion edge into it (route up)", () => {
    const relevantEdges = MEN_PYRAMID_EDGES.filter((e) => e.movement_type === "promotion");

    const promotedInto = new Set(relevantEdges.map((e) => e.to_division_id));

    for (const div of MEN_PYRAMID_DIVISIONS) {
      if (div.level <= 1) continue; // top level has no promotion into it
      if (div.level >= 10) continue; // bottom of defined model — no promotions from below
      expect(promotedInto.has(div.id)).toBe(true);
    }
  });

  it("every division above Level 10 has at least one relegation edge out of it (route down)", () => {
    const relevantEdges = MEN_PYRAMID_EDGES.filter((e) => e.movement_type === "relegation");

    const relegatedFrom = new Set(relevantEdges.map((e) => e.from_division_id));

    for (const div of MEN_PYRAMID_DIVISIONS) {
      if (div.level >= 10) continue; // bottom level has no relegation out of it
      expect(relegatedFrom.has(div.id)).toBe(true);
    }
  });

  it("every Level 9 (Step 5) division has at least one promotion edge to Level 8", () => {
    const level9Ids = new Set(
      MEN_PYRAMID_DIVISIONS.filter((d) => d.level === 9).map((d) => d.id)
    );
    const promosFrom9 = MEN_PYRAMID_EDGES.filter(
      (e) => e.movement_type === "promotion" && level9Ids.has(e.from_division_id)
    );

    const promotedFrom = new Set(promosFrom9.map((e) => e.from_division_id));
    for (const id of level9Ids) {
      expect(promotedFrom.has(id)).toBe(true);
    }
  });

  it("every Level 9 (Step 5) division has at least one relegation edge to Level 10", () => {
    const level9Ids = new Set(
      MEN_PYRAMID_DIVISIONS.filter((d) => d.level === 9).map((d) => d.id)
    );
    const relegsFrom9 = MEN_PYRAMID_EDGES.filter(
      (e) => e.movement_type === "relegation" && level9Ids.has(e.from_division_id)
    );

    const relegatedFrom = new Set(relegsFrom9.map((e) => e.from_division_id));
    for (const id of level9Ids) {
      expect(relegatedFrom.has(id)).toBe(true);
    }
  });

  it("every Level 10 (Step 6) division has at least one promotion edge to Level 9", () => {
    const level10Ids = new Set(
      MEN_PYRAMID_DIVISIONS.filter((d) => d.level === 10).map((d) => d.id)
    );
    const promosFrom10 = MEN_PYRAMID_EDGES.filter(
      (e) => e.movement_type === "promotion" && level10Ids.has(e.from_division_id)
    );

    const promotedFrom = new Set(promosFrom10.map((e) => e.from_division_id));
    for (const id of level10Ids) {
      expect(promotedFrom.has(id)).toBe(true);
    }
  });

  it("all edges connect divisions at adjacent levels only", () => {
    const divisionById = new Map(MEN_PYRAMID_DIVISIONS.map((d) => [d.id, d]));

    for (const edge of MEN_PYRAMID_EDGES) {
      const from = divisionById.get(edge.from_division_id);
      const to = divisionById.get(edge.to_division_id);
      expect(from).toBeDefined();
      expect(to).toBeDefined();
      const levelDiff = Math.abs(from!.level - to!.level);
      expect(levelDiff).toBe(1);
    }
  });

  it("no duplicate edge (same from, to, movement_type)", () => {
    const seen = new Set<string>();
    for (const edge of MEN_PYRAMID_EDGES) {
      const key = `${edge.from_division_id}:${edge.to_division_id}:${edge.movement_type}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("validates against supplied edges", () => {
    const issues = validatePyramidSeason(
      [
        { id: 1, template_id: 1, code: "alpha", name: "Alpha Division", level: 1, max_size: 2 },
        { id: 2, template_id: 1, code: "beta", name: "Beta Division", level: 2, max_size: 2 }
      ],
      [
        { id: 1, season_id: 1, template_id: 1, division_id: 1, status: "open", locked_at: null },
        { id: 2, season_id: 1, template_id: 1, division_id: 2, status: "open", locked_at: null }
      ],
      [
        { id: 1, season_id: 1, template_id: 1, season_division_id: 1, club_id: 10 },
        { id: 2, season_id: 1, template_id: 1, season_division_id: 2, club_id: 11 }
      ],
      [
        {
          id: 1,
          season_id: 1,
          template_id: 1,
          club_id: 10,
          from_season_division_id: 1,
          to_season_division_id: 2,
          movement_type: "promotion",
          note: null,
          created_at: "2026-05-10T00:00:00.000Z"
        }
      ],
      [
        { id: 1, from_division_id: 1, to_division_id: 2, movement_type: "promotion" }
      ]
    );

    expect(issues).toEqual([]);

    const rejected = validatePyramidSeason(
      [
        { id: 1, template_id: 1, code: "alpha", name: "Alpha Division", level: 1, max_size: 2 },
        { id: 2, template_id: 1, code: "beta", name: "Beta Division", level: 2, max_size: 2 }
      ],
      [
        { id: 1, season_id: 1, template_id: 1, division_id: 1, status: "open", locked_at: null },
        { id: 2, season_id: 1, template_id: 1, division_id: 2, status: "open", locked_at: null }
      ],
      [
        { id: 1, season_id: 1, template_id: 1, season_division_id: 1, club_id: 10 },
        { id: 2, season_id: 1, template_id: 1, season_division_id: 2, club_id: 11 }
      ],
      [
        {
          id: 1,
          season_id: 1,
          template_id: 1,
          club_id: 10,
          from_season_division_id: 1,
          to_season_division_id: 2,
          movement_type: "promotion",
          note: null,
          created_at: "2026-05-10T00:00:00.000Z"
        }
      ],
      []
    );

    expect(rejected).toEqual([
      expect.objectContaining({ code: "invalid_movement" })
    ]);
  });
});
