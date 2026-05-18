import { describe, expect, it } from "vitest";

import { createAppDatabase } from "@/lib/db/client";
import { parseCsv, createImportBatchFromCsv } from "@/lib/import";
import { createSource, getBatchRows, getBatch } from "@/lib/import";

const CSV_HEADERS = "Home,Away,Date,Time,Competition,Venue,Price,Status,Ticket URL,Source";

function basicCsv(headers: string, ...rows: string[]): string {
  return [headers, ...rows].join("\n");
}

describe("parseCsv — basic parsing", () => {
  it("parses rows with auto-detected headers", () => {
    const csv = basicCsv(
      "Home,Away,Date",
      "Team A,Team B,2026-05-20",
      "Team C,Team D,2026-06-01",
    );
    const result = parseCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].homeParticipantRaw).toBe("Team A");
    expect(result.rows[0].awayParticipantRaw).toBe("Team B");
    expect(result.rows[0].kickoffDate).toBe("2026-05-20");
    expect(result.rows[1].homeParticipantRaw).toBe("Team C");
  });

  it("returns empty result for empty CSV", () => {
    const result = parseCsv("");
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("returns empty result for whitespace-only CSV", () => {
    const result = parseCsv("  \n  \n");
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("falls back to positional mapping when headers are not recognised", () => {
    const csv = basicCsv(
      "Col1,Col2,Col3,Col4",
      "Team A,Team B,Prem,2026-05-20",
    );
    const result = parseCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1].homeParticipantRaw).toBe("Team A");
    expect(result.rows[1].awayParticipantRaw).toBe("Team B");
  });

  it("handles CSV with no header row (raw data only)", () => {
    const csv = "Team A,Team B,Premier League,2026-05-20,Stadium\nTeam C,Team D,Championship,2026-06-01";
    const result = parseCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].homeParticipantRaw).toBe("Team A");
    expect(result.rows[0].awayParticipantRaw).toBe("Team B");
    expect(result.rows[0].competitionRaw).toBe("Premier League");
  });
});

describe("parseCsv — quoted fields", () => {
  it("handles commas inside quoted fields", () => {
    const csv = basicCsv(
      CSV_HEADERS,
      '"Team A, FC","Team B, United",2026-05-20',
    );
    const result = parseCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].homeParticipantRaw).toBe("Team A, FC");
    expect(result.rows[0].awayParticipantRaw).toBe("Team B, United");
  });

  it("handles escaped quotes inside quoted fields", () => {
    const csv = basicCsv(
      CSV_HEADERS,
      '"Team ""A"" FC",Team B,2026-05-20',
    );
    const result = parseCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].homeParticipantRaw).toBe('Team "A" FC');
  });
});

describe("parseCsv — date and time parsing", () => {
  it("parses ISO dates", () => {
    const csv = basicCsv("Home,Away,Date", "Team A,Team B,2026-05-20");
    const result = parseCsv(csv);
    expect(result.rows[0].kickoffDate).toBe("2026-05-20");
  });

  it("parses UK format dates (DD/MM/YYYY)", () => {
    const csv = basicCsv("Home,Away,Date", "Team A,Team B,20/05/2026");
    const result = parseCsv(csv);
    expect(result.rows[0].kickoffDate).toBe("2026-05-20");
  });

  it("parses '20 May 2026' format", () => {
    const csv = basicCsv("Home,Away,Date", "Team A,Team B,20 May 2026");
    const result = parseCsv(csv);
    expect(result.rows[0].kickoffDate).toBe("2026-05-20");
  });

  it("parses combined date and time column into kickoffTime", () => {
    const csv = basicCsv("Home,Away,Date", "Team A,Team B,2026-05-20 15:00");
    const result = parseCsv(csv);
    expect(result.rows[0].kickoffDate).toBe("2026-05-20");
    expect(result.rows[0].kickoffTime).toBe("15:00");
  });

  it("parses 24-hour time", () => {
    const csv = basicCsv("Home, Away,Time", "Team A,Team B,19:45");
    const result = parseCsv(csv);
    expect(result.rows[0].kickoffTime).toBe("19:45");
  });

  it("parses 12-hour PM time", () => {
    const csv = basicCsv("Home,Away,Time", "Team A,Team B,3:00 PM");
    const result = parseCsv(csv);
    expect(result.rows[0].kickoffTime).toBe("15:00");
  });

  it("parses 12-hour AM time", () => {
    const csv = basicCsv("Home,Away,Time", "Team A,Team B,12:00 AM");
    const result = parseCsv(csv);
    expect(result.rows[0].kickoffTime).toBe("00:00");
  });

  it("leaves unrecognised date as-is", () => {
    const csv = basicCsv("Home,Away,Date", "Team A,Team B,not-a-date");
    const result = parseCsv(csv);
    expect(result.rows[0].kickoffDate).toBe("not-a-date");
  });

  it("rejects impossible date 31/02/2026", () => {
    // parseDateField returns undefined, raw value passes through
    const csv = basicCsv("Home,Away,Date", "Team A,Team B,31/02/2026");
    const result = parseCsv(csv);
    // The date field will have the raw value since parseDateField fails
    expect(result.rows[0].kickoffDate).toBe("31/02/2026");
  });

  it("rejects month 13 in UK format", () => {
    const csv = basicCsv("Home,Away,Date", "Team A,Team B,01/13/2026");
    const result = parseCsv(csv);
    expect(result.rows[0].kickoffDate).toBe("01/13/2026");
  });

  it("rejects invalid 24-hour time 25:00", () => {
    const csv = basicCsv("Home,Away,Time", "Team A,Team B,25:00");
    const result = parseCsv(csv);
    expect(result.rows[0].kickoffTime).toBe("25:00");
  });

  it("rejects invalid minutes 19:99", () => {
    const csv = basicCsv("Home,Away,Time", "Team A,Team B,19:99");
    const result = parseCsv(csv);
    expect(result.rows[0].kickoffTime).toBe("19:99");
  });

  it("rejects 12-hour hour 0", () => {
    const csv = basicCsv("Home,Away,Time", "Team A,Team B,0:00 AM");
    const result = parseCsv(csv);
    expect(result.rows[0].kickoffTime).toBe("0:00 AM");
  });

  it("rejects 12-hour hour 13", () => {
    const csv = basicCsv("Home,Away,Time", "Team A,Team B,13:00 PM");
    const result = parseCsv(csv);
    expect(result.rows[0].kickoffTime).toBe("13:00 PM");
  });
});

describe("parseCsv — price parsing", () => {
  it("parses price with pound symbol", () => {
    const csv = basicCsv("Home,Away,Price", "Team A,Team B,£15.00");
    const result = parseCsv(csv);
    expect(result.rows[0].adultPricePence).toBe(1500);
  });

  it("parses price without symbol", () => {
    const csv = basicCsv("Home,Away,Price", "Team A,Team B,15.50");
    const result = parseCsv(csv);
    expect(result.rows[0].adultPricePence).toBe(1550);
  });

  it("parses integer price", () => {
    const csv = basicCsv("Home,Away,Price", "Team A,Team B,10");
    const result = parseCsv(csv);
    expect(result.rows[0].adultPricePence).toBe(1000);
  });

  it("parses concession price separately", () => {
    const csv = basicCsv("Home,Away,Adult Price,Concession", "Team A,Team B,20,8");
    const result = parseCsv(csv);
    expect(result.rows[0].adultPricePence).toBe(2000);
    expect(result.rows[0].concessionPricePence).toBe(800);
  });

  it("parses zero price", () => {
    const csv = basicCsv("Home,Away,Price", "Team A,Team B,£0");
    const result = parseCsv(csv);
    expect(result.rows[0].adultPricePence).toBe(0);
  });
});

describe("parseCsv — missing fields and errors", () => {
  it("flags rows missing home team", () => {
    const csv = basicCsv(CSV_HEADERS, ",Team B,2026-05-20");
    const result = parseCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Missing home team");
  });

  it("flags rows missing away team", () => {
    const csv = basicCsv(CSV_HEADERS, "Team A,,2026-05-20");
    const result = parseCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Missing away team");
  });

  it("keeps valid rows and flags invalid rows separately", () => {
    const csv = basicCsv(
      CSV_HEADERS,
      "Team A,Team B,2026-05-20",
      ",Team D,2026-06-01",
      "Team E,Team F,2026-07-01",
    );
    const result = parseCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rowIndex).toBe(1);
  });
});

describe("parseCsv — field mapping", () => {
  it("maps venue and ground headers to venueRaw", () => {
    const csv = basicCsv(
      "Home,Away,Venue",
      "Team A,Team B,Stadium Name",
    );
    const result = parseCsv(csv);
    expect(result.rows[0].venueRaw).toBe("Stadium Name");
  });

  it("maps competition header", () => {
    const csv = basicCsv(
      "Home,Away,Competition",
      "Team A,Team B,Premier League",
    );
    const result = parseCsv(csv);
    expect(result.rows[0].competitionRaw).toBe("Premier League");
  });

  it("maps ticket URL and source URL", () => {
    const csv = basicCsv(
      "Home,Away,Ticket URL,Source",
      "Team A,Team B,https://tickets.example.com,https://example.com",
    );
    const result = parseCsv(csv);
    expect(result.rows[0].ticketUrl).toBe("https://tickets.example.com");
    expect(result.rows[0].sourceUrl).toBe("https://example.com");
  });

  it("maps status field", () => {
    const csv = basicCsv(
      "Home,Away,Status",
      "Team A,Team B,postponed",
    );
    const result = parseCsv(csv);
    expect(result.rows[0].status).toBe("postponed");
  });

  it("defaults invalid status to scheduled", () => {
    const csv = basicCsv(
      "Home,Away,Status",
      "Team A,Team B,unknown_status",
    );
    const result = parseCsv(csv);
    expect(result.rows[0].status).toBe("scheduled");
  });
});

describe("parseCsv — evidence", () => {
  it("includes original cells and headers in evidence", () => {
    const csv = basicCsv(
      "Home,Away",
      "Team A,Team B",
    );
    const result = parseCsv(csv);
    const evidence = result.rows[0].evidence as Record<string, unknown>;
    expect(evidence).toBeDefined();
    expect(evidence.original_cells).toEqual(["Team A", "Team B"]);
    expect(evidence.headers).toEqual(["Home", "Away"]);
  });
});

describe("createImportBatchFromCsv", () => {
  it("creates a batch with parsed rows", async () => {
    const db = createAppDatabase();
    const source = await createSource(db, {
      sourceType: "csv_paste",
      name: "Test CSV",
    });

    const csv = basicCsv(
      "Home,Away,Date,Competition",
      "Team A,Team B,2026-05-20,Premier League",
      "Team C,Team D,2026-06-01,Championship",
    );

    const result = await createImportBatchFromCsv(db, csv, source.id, "test-admin");

    expect(result.batchId).toBeGreaterThan(0);
    expect(result.rowCount).toBe(2);
    expect(result.errors).toHaveLength(0);

    const batch = await getBatch(db, result.batchId);
    expect(batch).toBeDefined();
    expect(batch!.rowCountTotal).toBe(2);
    expect(batch!.adapterType).toBe("csv_paste");
    expect(batch!.rawPayload).toBe(csv);

    const rows = await getBatchRows(db, result.batchId);
    expect(rows).toHaveLength(2);
    expect(rows[0].homeParticipantRaw).toBe("Team A");
    expect(rows[0].competitionRaw).toBe("Premier League");
  });

  it("sets rowCountTotal to total input rows (valid + errors)", async () => {
    const db = createAppDatabase();
    const source = await createSource(db, {
      sourceType: "csv_paste",
      name: "Count Test",
    });

    const csv = basicCsv(
      "Home,Away",
      "Team A,Team B",
      ",Team D",
      "Team E,Team F",
    );

    const result = await createImportBatchFromCsv(db, csv, source.id, "test-admin");
    const batch = await getBatch(db, result.batchId);

    expect(result.rowCount).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(batch!.rowCountTotal).toBe(3);
    expect(batch!.rowCountFailed).toBe(1);
    expect(batch!.parseErrorsJson).toBeTruthy();

    const parseErrors = JSON.parse(batch!.parseErrorsJson!);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0].message).toContain("Missing home team");
  });

  it("handles empty CSV gracefully", async () => {
    const db = createAppDatabase();
    const source = await createSource(db, {
      sourceType: "csv_paste",
      name: "Empty CSV",
    });

    const result = await createImportBatchFromCsv(db, "", source.id, "test-admin");
    expect(result.batchId).toBeGreaterThan(0);
    expect(result.rowCount).toBe(0);
  });

  it("preserves raw CSV in batch", async () => {
    const db = createAppDatabase();
    const source = await createSource(db, {
      sourceType: "csv_paste",
      name: "Raw CSV",
    });

    const csv = basicCsv("Home,Away", "Team A,Team B");
    await createImportBatchFromCsv(db, csv, source.id, "test-admin");

    const results = await db.all<{ raw_payload: string }>(
      "SELECT raw_payload FROM import_batches"
    );
    expect(results[0].raw_payload).toBe(csv);
  });

  it("accepts optional season label", async () => {
    const db = createAppDatabase();
    const source = await createSource(db, {
      sourceType: "csv_paste",
      name: "Season CSV",
    });

    const csv = basicCsv("Home,Away", "Team A,Team B");
    const result = await createImportBatchFromCsv(db, csv, source.id, "test-admin", {
      seasonLabel: "2025-26",
    });

    const batch = await getBatch(db, result.batchId);
    expect(batch!.seasonLabel).toBe("2025-26");
  });
});
