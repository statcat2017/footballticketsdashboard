import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/pyramid", () => ({
  CLUB_VENUE_ASSIGNMENTS: [],
  MEN_PYRAMID_TEMPLATE: { id: 1, code: "mens", name: "Men's English Pyramid", sport: "mens", status: "active" },
  MEN_PYRAMID_DIVISIONS: [
    { id: 1, template_id: 1, code: "premier-league", name: "Premier League", level: 1, max_size: 20 }
  ],
  MEN_PYRAMID_EDGES: [],
  MEN_PYRAMID_SEASONS: [{ id: 1, template_id: 1, season_label: "2025-26" }],
  MEN_PYRAMID_SEASON_DIVISIONS: [
    { id: 1, season_id: 1, template_id: 1, division_id: 1, status: "open", locked_at: null }
  ],
  MEN_PYRAMID_CLUBS: [
    {
      id: 1,
      name: "Stub Club",
      aliases: null,
      league_name: null,
      source_url: null,
      verified_at: null,
      status: "partial"
    }
  ],
  MEN_PYRAMID_MEMBERSHIPS: [
    { id: 1, season_id: 1, template_id: 1, season_division_id: 1, club_id: 1 }
  ],
  MEN_PYRAMID_MOVEMENTS: [
    {
      id: 1,
      season_id: 1,
      template_id: 1,
      club_id: 1,
      from_season_division_id: 1,
      to_season_division_id: 1,
      movement_type: "promotion",
      note: null,
      created_at: "2026-05-10T00:00:00.000Z"
    }
  ],
  computeDivisionDisplayOrder: () => new Map([[1, 1]]),
  computeEdgeAllocationType: () => new Map(),
  validatePyramidSeason: vi.fn(() => [])
}));

import { initializeD1Database } from "@/lib/db/d1";
import type { D1RootDatabaseLike, D1PreparedStatement, D1TransactionLike } from "@/lib/db/adapter";

describe("D1 initialization", () => {
  it("writes the pyramid sections before dependent rows", async () => {
    const operations: string[] = [];
    const batchSizes: number[] = [];
    const binding = createFakeBinding(operations, batchSizes);

    await initializeD1Database(binding);

    const clubsIndex = operations.findIndex((operation) => operation.includes("INSERT INTO clubs "));
    const membershipIndex = operations.findIndex((operation) => operation.includes("INSERT INTO pyramid_season_memberships "));
    const assignmentIndex = operations.findIndex((operation) => operation.includes("INSERT OR IGNORE INTO division_assignments "));
    const movementIndex = operations.findIndex((operation) => operation.includes("INSERT INTO pyramid_movements "));
    const batchIndex = operations.findIndex((operation) => operation.startsWith("batch:"));
    const schemaExec = operations.find((operation) => operation.startsWith("exec:"));

    expect(schemaExec).toContain("CREATE TABLE IF NOT EXISTS division_assignments");
    expect(clubsIndex).toBeGreaterThan(-1);
    expect(membershipIndex).toBeGreaterThan(-1);
    expect(assignmentIndex).toBeGreaterThan(-1);
    expect(movementIndex).toBeGreaterThan(-1);
    expect(clubsIndex).toBeLessThan(membershipIndex);
    expect(membershipIndex).toBeLessThan(assignmentIndex);
    expect(assignmentIndex).toBeLessThan(movementIndex);
    expect(clubsIndex).toBeLessThan(movementIndex);
    expect(batchIndex).toBe(operations.length - 1);
    const totalPrepares = operations.filter((operation) => operation.startsWith("prepare:"));
    const batchPrepares = totalPrepares.filter((op) => (
      !op.includes("pragma_table_info") &&
      !op.includes("SELECT COUNT(*) AS count FROM division_assignments")
    ));

    expect(batchSizes).toEqual([batchPrepares.length]);
  });
});

function createFakeBinding(operations: string[], batchSizes: number[]): D1RootDatabaseLike {
  return {
    prepare(query: string) {
      operations.push(`prepare:${query}`);
      const statement = {
        bind: (...values: Array<string | number | null>) => {
          void values;
          return statement;
        },
        async all<T>() {
          return { results: [] as T[] };
        },
        async first<T>() {
          return null as T | null;
        },
        async run() {
          return { success: true };
        }
      };
      return statement;
    },
    async exec(query: string) {
      operations.push(`exec:${query}`);
      return undefined;
    },
    async batch(statements: D1PreparedStatement[]) {
      batchSizes.push(statements.length);
      operations.push(`batch:${statements.length}`);
      return statements.map(() => ({ success: true }));
    },
    async transaction<T>(callback: (txn: D1TransactionLike) => Promise<T>): Promise<T> {
      return callback(this);
    }
  };
}
