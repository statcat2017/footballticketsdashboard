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

const level7Clubs = MEN_PYRAMID_CLUBS.filter((c) => c.id >= level7Start && c.id <= level7End);
const level8Clubs = MEN_PYRAMID_CLUBS.filter((c) => c.id >= level8Start && c.id <= level8End);

const level7Memberships = MEN_PYRAMID_MEMBERSHIPS.filter((m) => m.club_id >= level7Start && m.club_id <= level7End);
const level8Memberships = MEN_PYRAMID_MEMBERSHIPS.filter((m) => m.club_id >= level8Start && m.club_id <= level8End);

const level7Assignments = CLUB_VENUE_ASSIGNMENTS.filter((a) => a.club_id >= level7Start && a.club_id <= level7End);
const level8Assignments = CLUB_VENUE_ASSIGNMENTS.filter((a) => a.club_id >= level8Start && a.club_id <= level8End);

const allVenueIds = new Set(SEED_DATA.venues.map((v) => v.id));

describe("Level 7 pyramid data integrity", () => {
  it("has exactly 87 clubs", () => {
    expect(level7Clubs).toHaveLength(87);
  });

  it("has exactly 87 memberships", () => {
    expect(level7Memberships).toHaveLength(87);
  });

  it("has exactly 87 primary venue assignments", () => {
    expect(level7Assignments).toHaveLength(87);
    const allPrimary = level7Assignments.every((a) => a.is_primary === 1);
    expect(allPrimary).toBe(true);
  });

  it("every venue assignment references an existing venue", () => {
    const missing = level7Assignments.filter((a) => !allVenueIds.has(a.venue_id));
    expect(missing).toEqual([]);
  });

  it("every venue is marked precise (is_approximate = 0)", () => {
    const level7Venues = SEED_DATA.venues.filter((v) => v.id >= level7Start && v.id <= level7End && v.id !== 261);
    const allPrecise = level7Venues.every((v) => v.is_approximate === 0);
    expect(allPrecise).toBe(true);
  });

  it("has no duplicate clubs across season divisions", () => {
    const clubIds = level7Memberships.map((m) => m.club_id);
    expect(new Set(clubIds).size).toBe(clubIds.length);
  });

  it("every membership references an existing club", () => {
    const clubIds = new Set(level7Clubs.map((c) => c.id));
    const missing = level7Memberships.filter((m) => !clubIds.has(m.club_id));
    expect(missing).toEqual([]);
  });

  it("every club has exactly one membership", () => {
    const membershipCounts = new Map<number, number>();
    for (const m of level7Memberships) {
      membershipCounts.set(m.club_id, (membershipCounts.get(m.club_id) ?? 0) + 1);
    }
    const multiples = [...membershipCounts.entries()].filter(([, count]) => count !== 1);
    expect(multiples).toEqual([]);
  });
});

describe("Level 8 pyramid data integrity", () => {
  it("has exactly 176 clubs", () => {
    expect(level8Clubs).toHaveLength(176);
  });

  it("has exactly 176 memberships", () => {
    expect(level8Memberships).toHaveLength(176);
  });

  it("has exactly 176 primary venue assignments", () => {
    expect(level8Assignments).toHaveLength(176);
    const allPrimary = level8Assignments.every((a) => a.is_primary === 1);
    expect(allPrimary).toBe(true);
  });

  it("every venue assignment references an existing venue", () => {
    const missing = level8Assignments.filter((a) => !allVenueIds.has(a.venue_id));
    expect(missing).toEqual([]);
  });

  it("every venue is marked approximate (is_approximate = 1)", () => {
    const level8Venues = SEED_DATA.venues.filter((v) => v.id >= level8Start && v.id <= level8End);
    const allApproximate = level8Venues.every((v) => v.is_approximate === 1);
    expect(allApproximate).toBe(true);
  });

  it("has no duplicate clubs across season divisions", () => {
    const clubIds = level8Memberships.map((m) => m.club_id);
    expect(new Set(clubIds).size).toBe(clubIds.length);
  });

  it("every membership references an existing club", () => {
    const clubIds = new Set(level8Clubs.map((c) => c.id));
    const missing = level8Memberships.filter((m) => !clubIds.has(m.club_id));
    expect(missing).toEqual([]);
  });

  it("every club has exactly one membership", () => {
    const membershipCounts = new Map<number, number>();
    for (const m of level8Memberships) {
      membershipCounts.set(m.club_id, (membershipCounts.get(m.club_id) ?? 0) + 1);
    }
    const multiples = [...membershipCounts.entries()].filter(([, count]) => count !== 1);
    expect(multiples).toEqual([]);
  });
});

describe("Level 7 + 8 combined", () => {
  it("has exactly 263 total new clubs", () => {
    expect(level7Clubs.length + level8Clubs.length).toBe(263);
  });

  it("no club appears in both Level 7 and Level 8", () => {
    const l7 = new Set(level7Clubs.map((c) => c.id));
    const l8 = new Set(level8Clubs.map((c) => c.id));
    for (const id of l7) {
      expect(l8.has(id)).toBe(false);
    }
  });
});
