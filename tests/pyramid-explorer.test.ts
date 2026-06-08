import { beforeAll, describe, expect, it } from "vitest";

import { createAppDatabase } from "@/lib/db/client";
import {
  MEN_PYRAMID_DIVISIONS,
  MEN_PYRAMID_EDGES,
  MEN_PYRAMID_MEMBERSHIPS,
  MEN_PYRAMID_SEASONS
} from "@/lib/db/pyramid";
import {
  getPyramidExplorerData,
  type PyramidExplorerData
} from "@/lib/db/pyramid-explorer";

describe("pyramid explorer data service", () => {
  let data: PyramidExplorerData;

  beforeAll(async () => {
    const db = await createAppDatabase();
    data = await getPyramidExplorerData(db);
  });

  it("returns the latest season metadata", () => {
    expect(data.season.id).toBe(MEN_PYRAMID_SEASONS[0].id);
    expect(data.season.label).toBe(MEN_PYRAMID_SEASONS[0].season_label);
  });

  it("returns all 52 divisions", () => {
    expect(data.divisions).toHaveLength(MEN_PYRAMID_DIVISIONS.length);
  });

  it("each division has required fields", () => {
    for (const d of data.divisions) {
      expect(d.id).toBeGreaterThan(0);
      expect(d.code).toBeTruthy();
      expect(d.name).toBeTruthy();
      expect(d.level).toBeGreaterThanOrEqual(1);
      expect(d.level).toBeLessThanOrEqual(10);
      expect(d.max_size).toBeGreaterThan(0);
      expect(typeof d.club_count).toBe("number");
      expect(Array.isArray(d.clubs)).toBe(true);
    }
  });

  it("returns all 129 edges", () => {
    expect(data.edges).toHaveLength(MEN_PYRAMID_EDGES.length);
  });

  it("each edge has required fields", () => {
    for (const e of data.edges) {
      expect(e.id).toBeGreaterThan(0);
      expect(e.from_division_id).toBeGreaterThan(0);
      expect(e.to_division_id).toBeGreaterThan(0);
      expect(["promotion", "relegation"]).toContain(e.movement_type);
      expect(["fixed", "allocation_dependent"]).toContain(e.allocation_type);
    }
  });

  it("edges include allocation_type from DB (not from constants)", () => {
    for (const e of data.edges) {
      expect(e.allocation_type).toBeTruthy();
    }
  });

  it("returns club search rows", () => {
    expect(data.clubs.length).toBeGreaterThan(0);
  });

  it("each club search row has required fields", () => {
    for (const c of data.clubs) {
      expect(c.club_id).toBeGreaterThan(0);
      expect(c.club_name).toBeTruthy();
      expect(c.division_id).toBeGreaterThan(0);
      expect(c.division_code).toBeTruthy();
      expect(c.division_name).toBeTruthy();
      expect(c.level).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns one club search row per membership", () => {
    expect(data.clubs).toHaveLength(MEN_PYRAMID_MEMBERSHIPS.length);
  });

  it("club search rows are in consistent non-descending order", () => {
    const names = data.clubs.map((c) => c.club_name);
    for (let i = 1; i < names.length; i++) {
      expect(names[i - 1] <= names[i]).toBe(true);
    }
  });

  it("club counts per division match membership distribution", () => {
    const totalFromCounts = data.divisions.reduce((sum, d) => sum + d.club_count, 0);
    expect(totalFromCounts).toBe(MEN_PYRAMID_MEMBERSHIPS.length);
  });

  it("each division's nested clubs array matches its club_count", () => {
    for (const d of data.divisions) {
      expect(d.clubs.length).toBe(d.club_count);
    }
  });

  it("total nested clubs equals total memberships", () => {
    const totalNested = data.divisions.reduce((sum, d) => sum + d.clubs.length, 0);
    expect(totalNested).toBe(MEN_PYRAMID_MEMBERSHIPS.length);
  });

  it("divisions are ordered by level then display_order", () => {
    for (let i = 1; i < data.divisions.length; i++) {
      const prev = data.divisions[i - 1];
      const curr = data.divisions[i];
      if (prev.level === curr.level) {
        if (prev.display_order != null && curr.display_order != null) {
          expect(prev.display_order).toBeLessThan(curr.display_order);
        }
      } else {
        expect(prev.level).toBeLessThan(curr.level);
      }
    }
  });

  it("fixed edges match the rule: both divisions level <= 6", () => {
    const divLevel = new Map(data.divisions.map((d) => [d.id, d.level]));
    for (const e of data.edges) {
      const fromLevel = divLevel.get(e.from_division_id);
      const toLevel = divLevel.get(e.to_division_id);
      expect(fromLevel).toBeDefined();
      expect(toLevel).toBeDefined();
      if (e.allocation_type === "fixed") {
        expect(fromLevel!).toBeLessThanOrEqual(6);
        expect(toLevel!).toBeLessThanOrEqual(6);
      }
    }
  });

  it("returns empty data when no season exists", async () => {
    const db = await createAppDatabase();
    await db.exec("DELETE FROM pyramid_seasons");
    const result = await getPyramidExplorerData(db);
    expect(result.season.id).toBe(0);
    expect(result.season.label).toBe("");
    expect(result.divisions).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.clubs).toEqual([]);
  });
});
