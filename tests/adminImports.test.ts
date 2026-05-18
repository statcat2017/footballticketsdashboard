import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSqliteAppDatabase } from "@/lib/db/adapter";
import type { AppDatabase } from "@/lib/db/adapter";
import { applySchema } from "@/lib/db/setup";
import { createSource, createBatch, addBatchRows } from "@/lib/import";
import { getSeasons, getRecentBatches, getBatchDetail, getSources } from "@/lib/admin/imports";
import type { NormalizedFixtureRow } from "@/lib/import";

vi.mock("@/lib/admin/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/auth")>("@/lib/admin/auth");
  return { ...actual, getAdminSessionFromRequest: vi.fn().mockResolvedValue({}) };
});

vi.mock("@/lib/admin/csrf", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/csrf")>("@/lib/admin/csrf");
  return { ...actual, verifyAdminCsrfToken: vi.fn().mockResolvedValue(true) };
});

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn<() => Promise<AppDatabase>>(),
}));

vi.mock("@/lib/db/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/client")>("@/lib/db/client");
  return { ...actual, getDatabase };
});

function setupTestDb(): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  applySchema(sqlite);
  const db = createSqliteAppDatabase(sqlite);
  // Insert minimal seed data for tests
  db.exec(`
    INSERT INTO competitions (code, name, tier) VALUES ('PL', 'Premier League', 1);
    INSERT INTO fixture_seasons (label, starts_on, ends_on, is_current) VALUES ('2025-26', '2025-08-01', '2026-07-31', 1);
  `);
  return db;
}

describe("getSeasons", () => {
  afterEach(() => { getDatabase.mockReset(); });

  it("returns seasons sorted by starts_on DESC", async () => {
    const db = setupTestDb();
    getDatabase.mockResolvedValue(db);

    // One season seeded by migration
    const seasons = await getSeasons(db);
    expect(seasons.length).toBeGreaterThanOrEqual(1);
    expect(seasons[0].label).toBe("2025-26");
    expect(seasons[0].isCurrent).toBe(true);
  });
});

describe("getRecentBatches", () => {
  afterEach(() => { getDatabase.mockReset(); });

  it("returns empty list when no batches exist", async () => {
    const db = setupTestDb();
    getDatabase.mockResolvedValue(db);

    const batches = await getRecentBatches(db);
    expect(batches).toHaveLength(0);
  });

  it("returns batches with source names", async () => {
    const db = setupTestDb();
    getDatabase.mockResolvedValue(db);

    const src = await createSource(db, { sourceType: "csv_paste", name: "Test Source" });
    const batch = await createBatch(db, { sourceId: src.id, adapterType: "csv_paste", actor: "test" });

    const batches = await getRecentBatches(db);
    expect(batches).toHaveLength(1);
    expect(batches[0].sourceName).toBe("Test Source");
    expect(batches[0].id).toBe(batch.id);
  });
});

describe("getBatchDetail", () => {
  afterEach(() => { getDatabase.mockReset(); });

  it("returns batch with grouped rows and seasons", async () => {
    const db = setupTestDb();
    getDatabase.mockResolvedValue(db);

    const src = await createSource(db, { sourceType: "csv_paste", name: "Test" });
    const batch = await createBatch(db, { sourceId: src.id, adapterType: "csv_paste", actor: "test" });

    const rows: { rowIndex: number; row: NormalizedFixtureRow }[] = [
      { rowIndex: 0, row: { homeParticipantRaw: "Team A", awayParticipantRaw: "Team B" } },
    ];
    await addBatchRows(db, batch.id, rows);

    const detail = await getBatchDetail(db, batch.id);
    expect(detail.batch.id).toBe(batch.id);
    expect(detail.source?.name).toBe("Test");
    expect(detail.grouped.pending).toHaveLength(1);
    expect(detail.seasons.length).toBeGreaterThanOrEqual(1);
  });

  it("throws for non-existent batch", async () => {
    const db = setupTestDb();
    getDatabase.mockResolvedValue(db);

    await expect(getBatchDetail(db, 999)).rejects.toThrow("not found");
  });
});

describe("getSources", () => {
  afterEach(() => { getDatabase.mockReset(); });

  it("returns all sources", async () => {
    const db = setupTestDb();
    getDatabase.mockResolvedValue(db);

    await createSource(db, { sourceType: "csv_paste", name: "A" });

    const sources = await getSources(db);
    expect(sources).toHaveLength(1);
    expect(sources[0].name).toBe("A");
  });
});
