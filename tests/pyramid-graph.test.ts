import { beforeAll, describe, expect, it } from "vitest";

import { createAppDatabase } from "@/lib/db/client";
import { getPyramidExplorerData, type PyramidExplorerData } from "@/lib/db/pyramid-explorer";
import { computeLayout } from "@/app/components/pyramid/pyramidLayout";
import { edgePath } from "@/app/components/pyramid/PyramidGraph";
import type { PositionedDivision } from "@/app/components/pyramid/pyramidGraphTypes";

describe("pyramid graph layout", () => {
  let data: PyramidExplorerData;

  beforeAll(async () => {
    const db = createAppDatabase();
    data = await getPyramidExplorerData(db);
  });

  it("positions divisions by level on x axis in horizontal layout", () => {
    const result = computeLayout(data, { orientation: "horizontal" });

    for (const div of result.divisions) {
      const expectedX = (div.level - 1) * result.config.columnWidth;
      expect(div.x).toBe(expectedX);
    }
  });

  it("positions divisions by level on y axis in vertical layout", () => {
    const result = computeLayout(data, { orientation: "vertical" });

    for (const div of result.divisions) {
      const expectedY = (div.level - 1) * result.config.rowHeight;
      expect(div.y).toBe(expectedY);
    }
  });

  it("same-level divisions share the same x coordinate in horizontal layout", () => {
    const result = computeLayout(data, { orientation: "horizontal" });

    for (let i = 1; i < result.divisions.length; i++) {
      const prev = result.divisions[i - 1];
      const curr = result.divisions[i];

      if (prev.level === curr.level) {
        expect(curr.x).toBe(prev.x);
        expect(curr.y).not.toBe(prev.y);
      } else {
        expect(curr.x).toBeGreaterThan(prev.x);
      }
    }
  });

  it("all 52 divisions are positioned", () => {
    const result = computeLayout(data);
    expect(result.divisions).toHaveLength(52);
  });

  it("positioned divisions include all required fields", () => {
    const result = computeLayout(data);

    for (const d of result.divisions) {
      expect(typeof d.x).toBe("number");
      expect(typeof d.y).toBe("number");
      expect(d.id).toBeGreaterThan(0);
      expect(d.code).toBeTruthy();
      expect(d.level).toBeGreaterThanOrEqual(1);
    }
  });

  it("layout result is deterministic for the same input", () => {
    const a = computeLayout(data);
    const b = computeLayout(data);

    expect(a.divisions).toEqual(b.divisions);
    expect(a.visualConnections).toEqual(b.visualConnections);
  });

  it("handles empty graph data without invalid dimensions", () => {
    const result = computeLayout({
      season: { id: 0, label: "" },
      divisions: [],
      edges: [],
      clubs: []
    });

    expect(result.divisions).toEqual([]);
    expect(result.visualConnections).toEqual([]);
  });
});

describe("visual edge derivation", () => {
  let data: PyramidExplorerData;

  beforeAll(async () => {
    const db = createAppDatabase();
    data = await getPyramidExplorerData(db);
  });

  it("derives visual connections from all 129 edges", () => {
    const result = computeLayout(data);

    expect(data.edges).toHaveLength(129);
    expect(result.visualConnections.length).toBeGreaterThan(0);
    expect(result.visualConnections.length).toBeLessThanOrEqual(129);
  });

  it("every visual connection has valid fields", () => {
    const result = computeLayout(data);

    for (const vc of result.visualConnections) {
      expect(vc.fromDivisionId).toBeGreaterThan(0);
      expect(vc.toDivisionId).toBeGreaterThan(0);
      expect(vc.fromDivisionId).not.toBe(vc.toDivisionId);
      expect(["fixed", "allocation_dependent", "one_way_warning"]).toContain(vc.type);
      expect(typeof vc.isReciprocal).toBe("boolean");
    }
  });

  it("connections always go from higher level to lower level", () => {
    const result = computeLayout(data);
    const divLevel = new Map(data.divisions.map((d) => [d.id, d.level]));

    for (const vc of result.visualConnections) {
      const fromLevel = divLevel.get(vc.fromDivisionId);
      const toLevel = divLevel.get(vc.toDivisionId);
      expect(fromLevel).toBeDefined();
      expect(toLevel).toBeDefined();
      expect(fromLevel!).toBeLessThan(toLevel!);
    }
  });

  it("reciprocal connections are either fixed or allocation_dependent", () => {
    const result = computeLayout(data);

    for (const vc of result.visualConnections) {
      if (vc.isReciprocal) {
        expect(["fixed", "allocation_dependent"]).toContain(vc.type);
      }
    }
  });

  it("fixed connections only exist between level <= 6 divisions", () => {
    const result = computeLayout(data);
    const divLevel = new Map(data.divisions.map((d) => [d.id, d.level]));

    for (const vc of result.visualConnections) {
      if (vc.type === "fixed") {
        expect(divLevel.get(vc.fromDivisionId)).toBeLessThanOrEqual(6);
        expect(divLevel.get(vc.toDivisionId)).toBeLessThanOrEqual(6);
      }
    }
  });

  it("one-way warning edges exist (non-reciprocal connections)", () => {
    const result = computeLayout(data);
    const warnings = result.visualConnections.filter((vc) => vc.type === "one_way_warning");

    expect(warnings.length).toBeGreaterThan(0);
    for (const w of warnings) {
      expect(w.isReciprocal).toBe(false);
    }
  });

  it("reciprocal connections have both promotion and relegation edges", () => {
    const result = computeLayout(data);

    for (const vc of result.visualConnections) {
      if (!vc.isReciprocal) continue;

      const forwardEdges = data.edges.filter(
        (e) => e.from_division_id === vc.fromDivisionId && e.to_division_id === vc.toDivisionId
      );
      const backwardEdges = data.edges.filter(
        (e) => e.from_division_id === vc.toDivisionId && e.to_division_id === vc.fromDivisionId
      );

      expect(forwardEdges.length).toBeGreaterThanOrEqual(1);
      expect(backwardEdges.length).toBeGreaterThanOrEqual(1);

      const fromHigherToLower = forwardEdges.some((e) => e.movement_type === "relegation");
      const fromLowerToHigher = backwardEdges.some((e) => e.movement_type === "promotion");
      expect(fromHigherToLower || fromLowerToHigher).toBe(true);
    }
  });
});

describe("edgePath orientation", () => {
  const nodeWidth = 190;
  const nodeHeight = 42;

  const fromDiv: PositionedDivision = {
    id: 1, code: "PR", name: "Premier League", level: 1, max_size: 20,
    display_order: 1, club_count: 20, clubs: [], x: 0, y: 0
  };

  const toDiv: PositionedDivision = {
    id: 2, code: "CH", name: "Championship", level: 2, max_size: 24,
    display_order: 1, club_count: 24, clubs: [], x: 220, y: 0
  };

  it("horizontal edgePath draws from right edge of source to left edge of target", () => {
    const path = edgePath(fromDiv, toDiv, nodeWidth, nodeHeight, "horizontal");

    expect(path).toContain(`M ${nodeWidth} 21`);
    expect(path).toContain(`${toDiv.x} 21`);
  });

  it("vertical edgePath draws from bottom edge of source to top edge of target", () => {
    const path = edgePath(fromDiv, toDiv, nodeWidth, nodeHeight, "vertical");

    expect(path).toContain(`M 95 42`);
    expect(path).toContain(`${toDiv.x + nodeWidth / 2} 0`);
  });
});
