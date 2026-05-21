import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSqliteAppDatabase } from "@/lib/db/adapter";
import type { AppDatabase } from "@/lib/db/adapter";
import { applySchema } from "@/lib/db/setup";
import { createSource, createBatch, addBatchRows } from "@/lib/import";
import { getBatchRows } from "@/lib/import/importBatch";
import { getSeasons, getRecentBatches, getBatchDetail, getSources, getImportPreviewCounts } from "@/lib/admin/imports";
import type { ImportBatchRow, NormalizedFixtureRow } from "@/lib/import";

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

describe("repairs route - create_venue_and_assign cross-batch protection", () => {
  afterEach(() => { getDatabase.mockReset(); });

  it("rejects redirect_row_id from a different batch", async () => {
    const db = setupTestDb();
    getDatabase.mockResolvedValue(db);

    // Create two batches with rows
    const src = await createSource(db, { sourceType: "csv_paste", name: "Src" });
    const batchA = await createBatch(db, { sourceId: src.id, adapterType: "csv_paste", actor: "test" });
    await addBatchRows(db, batchA.id, [
      { rowIndex: 0, row: { homeParticipantRaw: "Team A", awayParticipantRaw: "Team B" } },
    ]);

    const batchB = await createBatch(db, { sourceId: src.id, adapterType: "csv_paste", actor: "test" });
    await addBatchRows(db, batchB.id, [
      { rowIndex: 0, row: { homeParticipantRaw: "Team C", awayParticipantRaw: "Team D" } },
    ]);

    const rowsB = await getBatchRows(db, batchB.id);
    const crossBatchRowId = rowsB[0].id;

    // Create a club to assign venue to
    await db.run(`INSERT INTO clubs (id, name) VALUES (999, 'Test Club')`);

    const form = new FormData();
    form.append("_action", "create_venue_and_assign");
    form.append("csrf", "test-csrf");
    form.append("name", "Cross Batch Venue");
    form.append("postcode", "CB1 1BC");
    form.append("latitude", "51.5");
    form.append("longitude", "-0.1");
    form.append("club_id", "999");
    form.append("redirect_row_id", String(crossBatchRowId));
    form.append("is_approximate", "0");
    form.append("coordinate_precision", "ground_approximate");
    form.append("effective_from", "2026-07-01");

    const { POST } = await import("@/app/api/admin/imports/[id]/repairs/route");
    const response = await POST(
      new Request(`http://localhost/admin/imports/${batchA.id}`, { method: "POST", body: form }),
      { params: Promise.resolve({ id: String(batchA.id) }) },
    );

    // Should reject with error redirect
    expect(response.status).toBe(303);
    const location = response.headers.get("Location") || "";
    expect(location).toContain("error=");
    expect(location).toContain("different+batch");

    // No venue should have been created
    const venues = await db.all("SELECT id, name FROM venues");
    expect(venues).toHaveLength(0);

    // Batch B's row should not have been mutated
    const rowsBAfter = await getBatchRows(db, batchB.id);
    expect(rowsBAfter[0].venueRaw).toBeNull();
  });
});

function previewRow(id: number, matchResult: ImportBatchRow["matchResult"]): ImportBatchRow {
  return {
    id,
    batchId: 1,
    rowIndex: id,
    homeParticipantRaw: "Home",
    awayParticipantRaw: "Away",
    homeParticipantResolvedId: null,
    awayParticipantResolvedId: null,
    homeIsOneOff: false,
    awayIsOneOff: false,
    competitionRaw: null,
    competitionResolvedCode: null,
    venueRaw: null,
    venueResolvedId: null,
    kickoffDate: null,
    kickoffTime: null,
    status: null,
    ticketUrl: null,
    adultPricePence: null,
    concessionPricePence: null,
    sourceUrl: null,
    evidenceJson: null,
    confidence: "unknown",
    matchResult,
    warningsJson: null,
    finalAction: null,
    finalFixtureId: null,
    createdAt: "2026-05-21T00:00:00.000Z",
  };
}

describe("getImportPreviewCounts", () => {
  it("keeps insert and update preview counts separate", () => {
    const counts = getImportPreviewCounts({
      insert: [previewRow(1, "insert"), previewRow(2, "insert")],
      update: [previewRow(3, "update")],
      blocked: [previewRow(4, "blocked")],
      pending: [previewRow(5, null)],
    });

    expect(counts).toEqual({
      insert: 2,
      update: 1,
      blocked: 1,
      skipped: 0,
      pending: 1,
    });
  });

  it("counts explicit skips and duplicate rows as skipped preview rows", () => {
    const counts = getImportPreviewCounts({
      skip: [previewRow(1, "skip")],
      duplicate_existing_fixture: [previewRow(2, "duplicate_existing_fixture")],
      duplicate_pending_batch: [previewRow(3, "duplicate_pending_batch")],
      duplicate_same_batch: [previewRow(4, "duplicate_same_batch")],
    });

    expect(counts.skipped).toBe(4);
    expect(counts.insert).toBe(0);
    expect(counts.update).toBe(0);
  });
});
