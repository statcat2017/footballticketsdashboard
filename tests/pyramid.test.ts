import { describe, expect, it } from "vitest";

import {
  MEN_PYRAMID_DIVISIONS,
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
