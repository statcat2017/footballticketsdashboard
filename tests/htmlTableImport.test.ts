import { describe, expect, it, vi } from "vitest";

import { createAppDatabase } from "@/lib/db/client";
import {
  validateFixtureUrl,
  extractTables,
  parseHtmlTableRows,
  createImportBatchFromHtmlUrl,
  getBatchRows,
  getBatch,
} from "@/lib/import";

vi.mock("node:dns", () => ({
  promises: {
    resolve4: vi.fn().mockResolvedValue([]),
    resolve6: vi.fn().mockRejectedValue(new Error("no v6")),
  },
}));

import { promises as dnsPromises } from "node:dns";

function simpleFixtureTable(caption?: string): string {
  const cap = caption ? `  <caption>${caption}</caption>\n` : "";
  return `<html><body>
<table>\n${cap}  <tr><th>Home</th><th>Away</th><th>Date</th><th>Competition</th></tr>
  <tr><td>Team A</td><td>Team B</td><td>2026-05-20</td><td>Premier League</td></tr>
  <tr><td>Team C</td><td>Team D</td><td>2026-06-01</td><td>Championship</td></tr>
</table>
</body></html>`;
}

function multiTableHtml(): string {
  return `<html><body>
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
}

function nonFixtureTable(): string {
  return `<html><body>
<table>
  <tr><th>Name</th><th>Age</th><th>City</th></tr>
  <tr><td>John</td><td>30</td><td>London</td></tr>
</table>
</body></html>`;
}

describe("validateFixtureUrl", () => {
  it("accepts valid https URL", () => {
    expect(validateFixtureUrl("https://example.com/fixtures")).toBeNull();
  });

  it("accepts valid http URL", () => {
    expect(validateFixtureUrl("http://example.com/fixtures")).toBeNull();
  });

  it("rejects ftp URL", () => {
    expect(validateFixtureUrl("ftp://example.com")).toBe("Only http:// and https:// URLs are allowed");
  });

  it("rejects file URL", () => {
    expect(validateFixtureUrl("file:///etc/passwd")).toBe("Only http:// and https:// URLs are allowed");
  });

  it("rejects localhost", () => {
    expect(validateFixtureUrl("http://localhost:3000/fixtures")).toContain("private or restricted");
  });

  it("rejects 127.0.0.1", () => {
    expect(validateFixtureUrl("http://127.0.0.1:3000/fixtures")).toContain("private or restricted");
  });

  it("rejects IPv6 loopback", () => {
    expect(validateFixtureUrl("http://[::1]:3000/fixtures")).toContain("private or restricted");
  });

  it("rejects private IPv4 10.x", () => {
    expect(validateFixtureUrl("http://10.0.0.1/fixtures")).toContain("private or restricted");
  });

  it("rejects private IPv4 192.168.x", () => {
    expect(validateFixtureUrl("http://192.168.1.1/fixtures")).toContain("private or restricted");
  });

  it("rejects link-local 169.254.x", () => {
    expect(validateFixtureUrl("http://169.254.169.254/fixtures")).toContain("private or restricted");
  });

  it("rejects URLs with credentials", () => {
    expect(validateFixtureUrl("https://user:pass@example.com")).toContain("credentials");
  });

  it("rejects invalid URL", () => {
    expect(validateFixtureUrl("not-a-url")).toContain("Invalid URL");
  });
});

describe("extractTables", () => {
  it("extracts a single fixture table with headers", () => {
    const tables = extractTables(simpleFixtureTable());
    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(["Home", "Away", "Date", "Competition"]);
    expect(tables[0].rowCount).toBe(2);
    expect(tables[0].caption).toBeNull();
  });

  it("extracts caption from <caption> tag", () => {
    const html = simpleFixtureTable("Premier League Fixtures");
    const tables = extractTables(html);
    expect(tables[0].caption).toBe("Premier League Fixtures");
  });

  it("extracts multiple tables", () => {
    const tables = extractTables(multiTableHtml());
    expect(tables).toHaveLength(2);
    expect(tables[0].caption).toBe("Premier League");
    expect(tables[1].caption).toBe("Championship");
  });

  it("extracts preceding heading as caption when no <caption>", () => {
    const tables = extractTables(multiTableHtml());
    expect(tables[0].caption).toBe("Premier League");
    expect(tables[1].caption).toBe("Championship");
  });

  it("returns sorted by score descending", () => {
    const html = `${simpleFixtureTable()}\n${nonFixtureTable()}`;
    const tables = extractTables(html);
    expect(tables).toHaveLength(2);
    expect(tables[0].score).toBeGreaterThanOrEqual(tables[1].score);
  });

  it("extracts sample cells for preview", () => {
    const tables = extractTables(simpleFixtureTable());
    expect(tables[0].sampleCells).toHaveLength(2);
    expect(tables[0].sampleCells[0][0]).toBe("Team A");
  });

  it("handles HTML with no tables", () => {
    const tables = extractTables("<html><body><p>No tables here</p></body></html>");
    expect(tables).toHaveLength(0);
  });

  it("handles tables with nested tags in cells", () => {
    const html = `<html><body>
<table>
  <tr><th>Home</th><th>Away</th></tr>
  <tr><td><strong>Team A</strong></td><td><a href="/team-b">Team B</a></td></tr>
</table>
</body></html>`;
    const tables = extractTables(html);
    expect(tables).toHaveLength(1);
    expect(tables[0].rows[0][0]).toBe("Team A");
    expect(tables[0].rows[0][1]).toBe("Team B");
  });

  it("scores fixture tables higher than non-fixture tables", () => {
    const fixtureTables = extractTables(simpleFixtureTable());
    const nonFixture = extractTables(nonFixtureTable());
    expect(fixtureTables[0].score).toBeGreaterThan(nonFixture[0].score);
  });
});

describe("parseHtmlTableRows", () => {
  it("parses rows into NormalizedFixtureRow array", () => {
    const tables = extractTables(simpleFixtureTable());
    const { rows } = parseHtmlTableRows(tables[0], "https://example.com");
    expect(rows).toHaveLength(2);
    expect(rows[0].homeParticipantRaw).toBe("Team A");
    expect(rows[0].awayParticipantRaw).toBe("Team B");
    expect(rows[0].kickoffDate).toBe("2026-05-20");
    expect(rows[0].competitionRaw).toBe("Premier League");
    expect(rows[1].homeParticipantRaw).toBe("Team C");
  });

  it("includes evidence with source URL and table info", () => {
    const tables = extractTables(simpleFixtureTable());
    const { rows } = parseHtmlTableRows(tables[0], "https://example.com/fixtures");
    const evidence = rows[0].evidence as Record<string, unknown>;
    expect(evidence.source_url).toBe("https://example.com/fixtures");
    expect(evidence.table_index).toBe(0);
    expect(evidence.row_index).toBe(0);
    expect(evidence.original_cells).toEqual(["Team A", "Team B", "2026-05-20", "Premier League"]);
  });

  it("handles tables with no detected headers (positional fallback)", () => {
    const html = `<html><body>
<table>
  <tr><td>Team A</td><td>Team B</td><td>2026-05-20</td></tr>
  <tr><td>Team C</td><td>Team D</td><td>2026-06-01</td></tr>
</table>
</body></html>`;
    const tables = extractTables(html);
    const { rows } = parseHtmlTableRows(tables[0], "https://example.com");
    expect(rows).toHaveLength(2);
    expect(rows[0].homeParticipantRaw).toBe("Team A");
    expect(rows[0].awayParticipantRaw).toBe("Team B");
  });

  it("rejects rows missing home team", () => {
    const html = `<html><body>
<table>
  <tr><th>Home</th><th>Away</th></tr>
  <tr><td></td><td>Team B</td></tr>
  <tr><td>Team C</td><td>Team D</td></tr>
</table>
</body></html>`;
    const tables = extractTables(html);
    const { rows, errors } = parseHtmlTableRows(tables[0], "https://example.com");
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Missing home team");
  });

  it("produces same NormalizedFixtureRow structure as CSV adapter", () => {
    const tables = extractTables(simpleFixtureTable());
    const { rows } = parseHtmlTableRows(tables[0], "https://example.com");
    const row = rows[0];
    expect(row.homeParticipantRaw).toBe("Team A");
    expect(row.awayParticipantRaw).toBe("Team B");
    expect(row.kickoffDate).toBe("2026-05-20");
    expect(row.competitionRaw).toBe("Premier League");
    expect(row.evidence).toBeDefined();
    expect(row.kickoffTime).toBeUndefined();
    expect(row.venueRaw).toBeUndefined();
    expect(row.status).toBeUndefined();
    expect(row.ticketUrl).toBeUndefined();
    expect(row.adultPricePence).toBeUndefined();
    expect(row.concessionPricePence).toBeUndefined();
    expect(row.sourceUrl).toBeUndefined();
  });
});

describe("createImportBatchFromHtmlUrl — fetch safety", () => {
  function mockRedirect(to: string, status = 302): typeof fetch {
    return vi.fn().mockResolvedValue(new Response(null, {
      status,
      headers: { location: to },
    }));
  }

  function mockFetchHtml(html: string, contentType?: string): typeof fetch {
    return vi.fn().mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { "content-type": contentType ?? "text/html" },
      })
    );
  }

  function mockFetchError(status: number, statusText: string): typeof fetch {
    return vi.fn().mockResolvedValue(
      new Response(null, { status, statusText })
    );
  }

  it("blocks redirect to private IP", async () => {
    const db = createAppDatabase();
    const fetcher = mockRedirect("http://127.0.0.1/latest");
    const result = await createImportBatchFromHtmlUrl(
      db, "https://evil.com/redirect", "test-admin", { fetcher }
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("private or restricted");
  });

  it("blocks redirect to localhost", async () => {
    const db = createAppDatabase();
    const fetcher = mockRedirect("http://localhost:3000/");
    const result = await createImportBatchFromHtmlUrl(
      db, "https://evil.com/redirect", "test-admin", { fetcher }
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("private or restricted");
  });

  it("blocks redirect to metadata IP", async () => {
    const db = createAppDatabase();
    const fetcher = mockRedirect("http://169.254.169.254/latest/meta-data/");
    const result = await createImportBatchFromHtmlUrl(
      db, "https://evil.com/redirect", "test-admin", { fetcher }
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("private or restricted");
  });

  it("enforces redirect cap", async () => {
    const db = createAppDatabase();
    const fetcher = vi.fn().mockImplementation(() => {
      return Promise.resolve(new Response(null, {
        status: 302,
        headers: { location: "https://example.com/next" },
      }));
    });
    const result = await createImportBatchFromHtmlUrl(
      db, "https://example.com/start", "test-admin", { fetcher }
    );
    expect(result.errors[0]).toContain("Too many redirects");
  });

  it("returns error on fetch failure", async () => {
    const db = createAppDatabase();
    const fetcher = mockFetchError(500, "Internal Server Error");
    const result = await createImportBatchFromHtmlUrl(
      db, "https://example.com/fixtures", "test-admin", { fetcher }
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("500");
  });

  it("returns error for non-HTML content", async () => {
    const db = createAppDatabase();
    const fetcher = mockFetchHtml("{}", "application/json");
    const result = await createImportBatchFromHtmlUrl(
      db, "https://example.com/data", "test-admin", { fetcher }
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("text/html");
  });

  it("returns error for blocked URL", async () => {
    const db = createAppDatabase();
    const result = await createImportBatchFromHtmlUrl(
      db, "http://localhost:3000/fixtures", "test-admin"
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("private or restricted");
  });

  it("blocks hostname that resolves to a private IP", async () => {
    (dnsPromises.resolve4 as ReturnType<typeof vi.fn>).mockResolvedValueOnce(["10.0.0.1"]);

    const db = createAppDatabase();
    const fetcher = mockFetchHtml("<html></html>");
    const result = await createImportBatchFromHtmlUrl(
      db, "https://internal-resolver.example.com", "test-admin", { fetcher }
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("private IP");
  });

  it("allows hostname that resolves to a public IP", async () => {
    (dnsPromises.resolve4 as ReturnType<typeof vi.fn>).mockResolvedValueOnce(["93.184.216.34"]);

    const db = createAppDatabase();
    const fetcher = mockFetchHtml(simpleFixtureTable());
    const result = await createImportBatchFromHtmlUrl(
      db, "https://example.com", "test-admin", { fetcher }
    );
    expect(result.errors).toHaveLength(0);
    expect(result.rowCount).toBe(2);
  });
});

describe("createImportBatchFromHtmlUrl — batch creation", () => {
  function mockFetchHtml(html: string): typeof fetch {
    return vi.fn().mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );
  }

  it("creates a batch from a fetched HTML page", async () => {
    const db = createAppDatabase();
    const fetcher = mockFetchHtml(simpleFixtureTable());
    const result = await createImportBatchFromHtmlUrl(
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

  it("selects only specified table indices", async () => {
    const db = createAppDatabase();
    const fetcher = mockFetchHtml(multiTableHtml());
    const result = await createImportBatchFromHtmlUrl(
      db, "https://example.com/fixtures", "test-admin",
      { fetcher, selectedTableIndices: [1] }
    );

    expect(result.rowCount).toBe(1);
    const rows = await getBatchRows(db, result.batchId);
    expect(rows[0].homeParticipantRaw).toBe("Team C");
  });

  it("creates and reuses a fixture source by origin", async () => {
    const db = createAppDatabase();
    const fetcher = mockFetchHtml(simpleFixtureTable());

    await createImportBatchFromHtmlUrl(
      db, "https://example.com/fixtures", "test-admin", { fetcher }
    );
    await createImportBatchFromHtmlUrl(
      db, "https://example.com/other", "test-admin", { fetcher }
    );

    const sources = await db.all<{ id: number; base_url: string }>(
      "SELECT id, base_url FROM fixture_sources WHERE source_type = 'url_table_scrape'"
    );
    expect(sources).toHaveLength(1);
    expect(sources[0].base_url).toBe("https://example.com");
  });

  it("returns all detected tables in result", async () => {
    const db = createAppDatabase();
    const fetcher = mockFetchHtml(multiTableHtml());
    const result = await createImportBatchFromHtmlUrl(
      db, "https://example.com/fixtures", "test-admin", { fetcher }
    );
    expect(result.tables).toHaveLength(2);
    expect(result.tables[0].rowCount).toBeGreaterThan(0);
  });

  it("accepts optional season label", async () => {
    const db = createAppDatabase();
    const fetcher = mockFetchHtml(simpleFixtureTable());
    const result = await createImportBatchFromHtmlUrl(
      db, "https://example.com/fixtures", "test-admin",
      { fetcher, seasonLabel: "2025-26" }
    );
    const batch = await getBatch(db, result.batchId);
    expect(batch!.seasonLabel).toBe("2025-26");
  });

  it("persists parse_errors_json for rows missing home/away", async () => {
    const db = createAppDatabase();
    const html = `<html><body>
<table>
  <tr><th>Home</th><th>Away</th></tr>
  <tr><td></td><td>Team B</td></tr>
  <tr><td>Team C</td><td>Team D</td></tr>
</table>
</body></html>`;
    const fetcher = mockFetchHtml(html);
    const result = await createImportBatchFromHtmlUrl(
      db, "https://example.com/fixtures", "test-admin", { fetcher }
    );

    expect(result.rowCount).toBe(1);
    expect(result.errors).toHaveLength(1);

    const batch = await getBatch(db, result.batchId);
    expect(batch!.rowCountTotal).toBe(2);
    expect(batch!.rowCountFailed).toBe(1);
    const parseErrors = JSON.parse(batch!.parseErrorsJson ?? "[]");
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0].message).toContain("Missing home team");
  });
});
