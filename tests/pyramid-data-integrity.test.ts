import { describe, expect, it } from "vitest";

import { SEED_DATA } from "@/lib/db/d1";
import {
  CLUB_VENUE_ASSIGNMENTS,
  MEN_PYRAMID_CLUBS,
  MEN_PYRAMID_MEMBERSHIPS,
} from "@/lib/db/pyramid";

const level7Start = 226;
const level7End = 312;
const level8Start = 313;
const level8End = 488;

const allVenueIds = new Set(SEED_DATA.venues.map((v) => v.id));

function describeLevel(title: string, start: number, end: number, expectApproximate: boolean) {
  const clubs = MEN_PYRAMID_CLUBS.filter((c) => c.id >= start && c.id <= end);
  const memberships = MEN_PYRAMID_MEMBERSHIPS.filter((m) => m.club_id >= start && m.club_id <= end);
  const assignments = CLUB_VENUE_ASSIGNMENTS.filter((a) => a.club_id >= start && a.club_id <= end);

  describe(title, () => {
    it("every club has exactly one membership", () => {
      const counts = new Map<number, number>();
      for (const m of memberships) {
        counts.set(m.club_id, (counts.get(m.club_id) ?? 0) + 1);
      }
      const multiples = [...counts.entries()].filter(([, count]) => count !== 1);
      expect(multiples).toEqual([]);
    });

    it("every membership references an existing club", () => {
      const clubIds = new Set(clubs.map((c) => c.id));
      const missing = memberships.filter((m) => !clubIds.has(m.club_id));
      expect(missing).toEqual([]);
    });

    it("no duplicate club IDs across season divisions", () => {
      const ids = memberships.map((m) => m.club_id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("every club has exactly one primary venue assignment", () => {
      expect(assignments.length).toBe(clubs.length);
      const allPrimary = assignments.every((a) => a.is_primary === 1);
      expect(allPrimary).toBe(true);
    });

    it("every venue assignment references an existing venue", () => {
      const missing = assignments.filter((a) => !allVenueIds.has(a.venue_id));
      expect(missing).toEqual([]);
    });

    it(`venues are ${expectApproximate ? "approximate" : "precise"} (is_approximate = ${expectApproximate ? 1 : 0})`, () => {
      const venues = SEED_DATA.venues.filter((v) => v.id >= start && v.id <= end);
      if (venues.length === 0) return;
      const allFlagged = venues.every((v) => v.is_approximate === (expectApproximate ? 1 : 0));
      expect(allFlagged).toBe(true);
    });
  });
}

describeLevel("Level 7 pyramid data", 226, 312, false);
describeLevel("Level 8 pyramid data", 313, 488, true);

describe("Levels 7 and 8 combined", () => {
  it("no club appears in both levels", () => {
    const l7 = new Set(MEN_PYRAMID_MEMBERSHIPS.filter((m) => m.club_id >= 226 && m.club_id <= 312).map((m) => m.club_id));
    const l8 = new Set(MEN_PYRAMID_MEMBERSHIPS.filter((m) => m.club_id >= 313 && m.club_id <= 488).map((m) => m.club_id));
    for (const id of l7) {
      expect(l8.has(id)).toBe(false);
    }
  });

  it("all clubs have unique names within the pyramid", () => {
    const names = MEN_PYRAMID_CLUBS.filter((c) => c.id >= 226).map((c) => c.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});
