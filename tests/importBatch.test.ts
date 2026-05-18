import { describe, expect, it } from "vitest";

import { createAppDatabase } from "@/lib/db/client";
import type { AppDatabase } from "@/lib/db/adapter";
import {
  createSource,
  getOrCreateSource,
  createBatch,
  addBatchRows,
  getBatchRows,
  getBatchRowsByMatchResult,
  updateBatchRowOutcome,
} from "@/lib/import";
import type { FixtureSourceInput, ImportBatch, NormalizedFixtureRow } from "@/lib/import";

function setupTestDb(): AppDatabase {
  return createAppDatabase();
}

async function createTestSource(db: AppDatabase, overrides?: Partial<FixtureSourceInput>): Promise<{ id: number; name: string }> {
  return createSource(db, {
    sourceType: "csv_paste",
    name: "Test Source",
    baseUrl: undefined,
    ...overrides,
  });
}

async function createTestBatch(db: AppDatabase, sourceId: number, overrides?: Partial<{ seasonLabel: string }>): Promise<ImportBatch> {
  return createBatch(db, {
    sourceId,
    adapterType: "csv_paste",
    actor: "test",
    rawPayload: undefined,
    ...overrides,
  });
}

async function createTestRows(db: AppDatabase, batchId: number): Promise<void> {
  const rows: { rowIndex: number; row: NormalizedFixtureRow }[] = [
    {
      rowIndex: 0,
      row: { homeParticipantRaw: "Team A", awayParticipantRaw: "Team B" },
    },
    {
      rowIndex: 1,
      row: { homeParticipantRaw: "Team C", awayParticipantRaw: "Team D" },
    },
  ];
  await addBatchRows(db, batchId, rows);
}

describe("getOrCreateSource", () => {
  it("creates a new source when none exists (by name)", async () => {
    const db = setupTestDb();
    const source = await getOrCreateSource(db, {
      sourceType: "csv_paste",
      name: "My CSV Source",
    });
    expect(source.id).toBeGreaterThan(0);
    expect(source.name).toBe("My CSV Source");
    expect(source.sourceType).toBe("csv_paste");
  });

  it("returns existing source when found by name", async () => {
    const db = setupTestDb();
    const first = await getOrCreateSource(db, {
      sourceType: "csv_paste",
      name: "My CSV Source",
    });
    const second = await getOrCreateSource(db, {
      sourceType: "csv_paste",
      name: "My CSV Source",
    });
    expect(second.id).toBe(first.id);
  });

  it("creates a new source when none exists (by base_url)", async () => {
    const db = setupTestDb();
    const source = await getOrCreateSource(db, {
      sourceType: "url_table_scrape",
      name: "https://example.com/fixtures",
      baseUrl: "https://example.com",
    });
    expect(source.id).toBeGreaterThan(0);
    expect(source.baseUrl).toBe("https://example.com");
  });

  it("returns existing source when found by base_url", async () => {
    const db = setupTestDb();
    const first = await getOrCreateSource(db, {
      sourceType: "url_table_scrape",
      name: "https://example.com/fixtures",
      baseUrl: "https://example.com",
    });
    const second = await getOrCreateSource(db, {
      sourceType: "url_table_scrape",
      name: "https://example.com/fixtures",
      baseUrl: "https://example.com",
    });
    expect(second.id).toBe(first.id);
  });

  it("does not create duplicate when called with same type+name", async () => {
    const db = setupTestDb();
    const first = await getOrCreateSource(db, {
      sourceType: "url_table_scrape",
      name: "Fixture Site",
      baseUrl: "https://example.com",
    });
    const second = await getOrCreateSource(db, {
      sourceType: "url_table_scrape",
      name: "Fixture Site",
      baseUrl: "https://example.com",
    });
    const all = await db.all("SELECT id FROM fixture_sources");
    expect(all).toHaveLength(1);
    expect(second.id).toBe(first.id);
  });

  it("preserves default trust level and auto-approval when creating", async () => {
    const db = setupTestDb();
    const source = await getOrCreateSource(db, {
      sourceType: "csv_paste",
      name: "Defaults Source",
    });
    expect(source.trustLevel).toBe("untrusted");
    expect(source.autoApproval).toBe(false);
  });
});

describe("addBatchRows", () => {
  it("inserts multiple rows into a batch", async () => {
    const db = setupTestDb();
    const source = await createTestSource(db);
    const batch = await createTestBatch(db, source.id);
    await createTestRows(db, batch.id);

    const rows = await getBatchRows(db, batch.id);
    expect(rows).toHaveLength(2);
    expect(rows[0].homeParticipantRaw).toBe("Team A");
    expect(rows[1].homeParticipantRaw).toBe("Team C");
  });

  it("preserves evidence as JSON", async () => {
    const db = setupTestDb();
    const source = await createTestSource(db);
    const batch = await createTestBatch(db, source.id);

    await addBatchRows(db, batch.id, [
      {
        rowIndex: 0,
        row: {
          homeParticipantRaw: "Team A",
          awayParticipantRaw: "Team B",
          evidence: { source_url: "https://example.com", row: 1 },
        },
      },
    ]);

    const row = (await getBatchRows(db, batch.id))[0];
    expect(JSON.parse(row.evidenceJson ?? "{}")).toEqual({
      source_url: "https://example.com",
      row: 1,
    });
  });

  it("defaults status and confidence", async () => {
    const db = setupTestDb();
    const source = await createTestSource(db);
    const batch = await createTestBatch(db, source.id);
    await createTestRows(db, batch.id);

    const row = (await getBatchRows(db, batch.id))[0];
    expect(row.status).toBe("scheduled");
    expect(row.confidence).toBe("unknown");
  });

  it("enforces unique (batch_id, row_index)", async () => {
    const db = setupTestDb();
    const source = await createTestSource(db);
    const batch = await createTestBatch(db, source.id);
    await createTestRows(db, batch.id);

    await expect(
      addBatchRows(db, batch.id, [
        {
          rowIndex: 0,
          row: { homeParticipantRaw: "Team E", awayParticipantRaw: "Team F" },
        },
      ])
    ).rejects.toThrow();
  });

  it("inserts rows with explicit ticket_url and source_url fields", async () => {
    const db = setupTestDb();
    const source = await createTestSource(db);
    const batch = await createTestBatch(db, source.id);

    await addBatchRows(db, batch.id, [
      {
        rowIndex: 0,
        row: {
          homeParticipantRaw: "Team A",
          awayParticipantRaw: "Team B",
          ticketUrl: "https://tickets.example.com",
          sourceUrl: "https://example.com/fixture",
        },
      },
    ]);

    const row = (await getBatchRows(db, batch.id))[0];
    expect(row.ticketUrl).toBe("https://tickets.example.com");
    expect(row.sourceUrl).toBe("https://example.com/fixture");
  });

  it("inserts rows with prices", async () => {
    const db = setupTestDb();
    const source = await createTestSource(db);
    const batch = await createTestBatch(db, source.id);

    await addBatchRows(db, batch.id, [
      {
        rowIndex: 0,
        row: {
          homeParticipantRaw: "Team A",
          awayParticipantRaw: "Team B",
          adultPricePence: 1500,
          concessionPricePence: 800,
        },
      },
    ]);

    const row = (await getBatchRows(db, batch.id))[0];
    expect(row.adultPricePence).toBe(1500);
    expect(row.concessionPricePence).toBe(800);
  });
});

describe("getBatchRowsByMatchResult", () => {
  it("groups rows by match_result", async () => {
    const db = setupTestDb();
    const source = await createTestSource(db);
    const batch = await createTestBatch(db, source.id);

    await addBatchRows(db, batch.id, [
      {
        rowIndex: 0,
        row: { homeParticipantRaw: "Team A", awayParticipantRaw: "Team B" },
      },
      {
        rowIndex: 1,
        row: { homeParticipantRaw: "Team C", awayParticipantRaw: "Team D" },
      },
      {
        rowIndex: 2,
        row: { homeParticipantRaw: "Team E", awayParticipantRaw: "Team F" },
      },
    ]);

    const rows = await getBatchRows(db, batch.id);

    await updateBatchRowOutcome(db, rows[0].id, { matchResult: "insert" });
    await updateBatchRowOutcome(db, rows[1].id, { matchResult: "blocked" });

    const grouped = await getBatchRowsByMatchResult(db, batch.id);
    expect(grouped.insert).toHaveLength(1);
    expect(grouped.blocked).toHaveLength(1);

    const pending = grouped.pending ?? [];
    expect(pending).toHaveLength(1);
    expect(pending[0].rowIndex).toBe(2);
  });

  it("treats null match_result as pending", async () => {
    const db = setupTestDb();
    const source = await createTestSource(db);
    const batch = await createTestBatch(db, source.id);
    await createTestRows(db, batch.id);

    const grouped = await getBatchRowsByMatchResult(db, batch.id);
    expect(grouped.pending).toHaveLength(2);
  });

  it("returns all match_result keys even when empty", async () => {
    const db = setupTestDb();
    const source = await createTestSource(db);
    const batch = await createTestBatch(db, source.id);
    await createTestRows(db, batch.id);

    const grouped = await getBatchRowsByMatchResult(db, batch.id);
    expect(grouped).toHaveProperty("insert");
    expect(grouped).toHaveProperty("update");
    expect(grouped).toHaveProperty("blocked");
    expect(grouped).toHaveProperty("skip");
    expect(grouped).toHaveProperty("pending");
  });
});

describe("updateBatchRowOutcome", () => {
  it("updates match_result and serializes warnings", async () => {
    const db = setupTestDb();
    const source = await createTestSource(db);
    const batch = await createTestBatch(db, source.id);
    await createTestRows(db, batch.id);

    const rows = await getBatchRows(db, batch.id);
    const updated = await updateBatchRowOutcome(db, rows[0].id, {
      matchResult: "blocked",
      warnings: [{ message: "Unknown club" }],
    });

    expect(updated.matchResult).toBe("blocked");
    expect(JSON.parse(updated.warningsJson ?? "{}")).toEqual([{ message: "Unknown club" }]);
  });

  it("updates resolved IDs", async () => {
    const db = setupTestDb();
    const source = await createTestSource(db);
    const batch = await createTestBatch(db, source.id);
    await createTestRows(db, batch.id);

    const rows = await getBatchRows(db, batch.id);
    const updated = await updateBatchRowOutcome(db, rows[0].id, {
      matchResult: "insert",
      homeParticipantResolvedId: 1,
      awayParticipantResolvedId: 2,
      competitionResolvedCode: "PL",
      venueResolvedId: 1,
    });

    expect(updated.homeParticipantResolvedId).toBe(1);
    expect(updated.awayParticipantResolvedId).toBe(2);
    expect(updated.competitionResolvedCode).toBe("PL");
    expect(updated.venueResolvedId).toBe(1);
  });

  it("updates final action", async () => {
    const db = setupTestDb();
    const source = await createTestSource(db);
    const batch = await createTestBatch(db, source.id);
    await createTestRows(db, batch.id);

    const rows = await getBatchRows(db, batch.id);
    const updated = await updateBatchRowOutcome(db, rows[0].id, {
      matchResult: "skip",
      finalAction: "skip",
    });

    expect(updated.finalAction).toBe("skip");
  });

  it("is a no-op when no fields are supplied", async () => {
    const db = setupTestDb();
    const source = await createTestSource(db);
    const batch = await createTestBatch(db, source.id);
    await createTestRows(db, batch.id);

    const rows = await getBatchRows(db, batch.id);
    const updated = await updateBatchRowOutcome(db, rows[0].id, {});
    expect(updated.matchResult).toBeNull();
  });
});
