import { describe, expect, it, vi } from "vitest";

import { createAppDatabase } from "@/lib/db/client";
import { csvFixtureSourceAdapter } from "@/lib/import/adapters/csv";
import { htmlTableFixtureSourceAdapter } from "@/lib/import/adapters/htmlTable";
import { getBatch, getBatchRows, createSource } from "@/lib/import";

vi.mock("node:dns", () => ({
  promises: {
    resolve4: vi.fn().mockResolvedValue([]),
    resolve6: vi.fn().mockRejectedValue(new Error("no v6")),
  },
}));

const CSV_HEADERS = "Home,Away,Date,Competition";

function basicCsv(...rows: string[]): string {
  return [CSV_HEADERS, ...rows].join("\n");
}

function simpleFixtureTableHtml(): string {
  return `<html><body>
<table>
  <tr><th>Home</th><th>Away</th><th>Date</th><th>Competition</th></tr>
  <tr><td>Team A</td><td>Team B</td><td>2026-05-20</td><td>Premier League</td></tr>
  <tr><td>Team C</td><td>Team D</td><td>2026-06-01</td><td>Championship</td></tr>
</table>
</body></html>`;
}

describe("FixtureSourceAdapter contract — createImportBatch", () => {
  describe("CSV adapter", () => {
    it("creates a batch through the adapter contract", async () => {
      const db = await createAppDatabase();
      const source = await createSource(db, {
        sourceType: "csv_paste",
        name: "Contract Test CSV",
      });

      const csv = basicCsv(
        "Team A,Team B,2026-05-20,Premier League",
        "Team C,Team D,2026-06-01,Championship",
      );

      const result = await csvFixtureSourceAdapter.createImportBatch!(
        db, csv, source.id, "test-admin"
      );

      expect(result.batchId).toBeGreaterThan(0);
      expect(result.rowCount).toBe(2);
      expect(result.errors).toHaveLength(0);

      const batch = await getBatch(db, result.batchId);
      expect(batch).toBeDefined();
      expect(batch!.rowCountTotal).toBe(2);
      expect(batch!.parseStatus).toBe("parsed");
      expect(batch!.approvalStatus).toBe("preview");

      const rows = await getBatchRows(db, result.batchId);
      expect(rows).toHaveLength(2);
      expect(rows[0].homeParticipantRaw).toBe("Team A");
      expect(rows[0].competitionRaw).toBe("Premier League");
    });

    it("accepts optional season label through the adapter contract", async () => {
      const db = await createAppDatabase();
      const source = await createSource(db, {
        sourceType: "csv_paste",
        name: "Season Label CSV",
      });

      const csv = basicCsv("Team A,Team B,2026-05-20,Premier League");

      const result = await csvFixtureSourceAdapter.createImportBatch!(
        db, csv, source.id, "test-admin", { seasonLabel: "2025-26" }
      );

      const batch = await getBatch(db, result.batchId);
      expect(batch!.seasonLabel).toBe("2025-26");
    });
  });

  describe("HTML adapter", () => {
    function mockFetchHtml(html: string): typeof fetch {
      return vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      );
    }

    it("creates a batch through the adapter contract", async () => {
      const db = await createAppDatabase();
      const fetcher = mockFetchHtml(simpleFixtureTableHtml());

      const result = await htmlTableFixtureSourceAdapter.createImportBatch!(
        db, "https://example.com/fixtures", "test-admin", { fetcher }
      );

      expect(result.batchId).toBeGreaterThan(0);
      expect(result.rowCount).toBe(2);
      expect(result.errors).toHaveLength(0);

      const batch = await getBatch(db, result.batchId);
      expect(batch).toBeDefined();
      expect(batch!.rowCountTotal).toBe(2);
      expect(batch!.parseStatus).toBe("parsed");
      expect(batch!.approvalStatus).toBe("preview");

      const rows = await getBatchRows(db, result.batchId);
      expect(rows).toHaveLength(2);
      expect(rows[0].homeParticipantRaw).toBe("Team A");
      expect(rows[0].competitionRaw).toBe("Premier League");
    });

    it("selects only specified table indices through the adapter contract", async () => {
      const db = await createAppDatabase();
      const multiTableHtml = `<html><body>
<h2>Saturday Fixtures</h2>
<table>
  <caption>Premier League</caption>
  <tr><th>Home</th><th>Away</th><th>Date</th></tr>
  <tr><td>Team A</td><td>Team B</td><td>2026-05-20</td></tr>
</table>
<h2>Sunday Fixtures</h2>
<table>
  <caption>Championship</caption>
  <tr><th>Home</th><th>Away</th><th>Date</th></tr>
  <tr><td>Team C</td><td>Team D</td><td>2026-06-01</td></tr>
</table>
</body></html>`;

      const fetcher = mockFetchHtml(multiTableHtml);

      const result = await htmlTableFixtureSourceAdapter.createImportBatch!(
        db, "https://example.com/fixtures", "test-admin",
        { fetcher, selectedTableIndices: [1] }
      );

      expect(result.rowCount).toBe(1);
      const rows = await getBatchRows(db, result.batchId);
      expect(rows[0].homeParticipantRaw).toBe("Team C");
    });

    it("returns error when selected table indices match no tables", async () => {
      const db = await createAppDatabase();
      const fetcher = mockFetchHtml(simpleFixtureTableHtml());

      const result = await htmlTableFixtureSourceAdapter.createImportBatch!(
        db, "https://example.com/fixtures", "test-admin",
        { fetcher, selectedTableIndices: [99] }
      );

      expect(result.batchId).toBe(0);
      expect(result.rowCount).toBe(0);
      expect(result.errors).toContain("No tables selected");
      expect(result.tables.length).toBeGreaterThan(0);
    });
  });
});
