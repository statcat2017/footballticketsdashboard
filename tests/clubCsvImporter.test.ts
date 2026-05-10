import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { importClubCsv, parseClubCsv } from "@/lib/db/clubCsvImporter";
import { createDatabase } from "@/lib/db/client";

const csv = `competition,club_name,football_data_team_id,aliases,ground_name,postcode,latitude,longitude,official_site_url,ticket_url,price_source_url,ground_source_url,coordinates_source_url,verified_at
PL,Test United,123,Test United FC|Test United,Test Ground,AA1 1AA,51.5,-0.1,https://test.example/,https://test.example/tickets,https://test.example/prices,https://test.example/ground,https://www.openstreetmap.org/search?query=Test%20Ground,2026-05-10
`;

describe("club CSV importer", () => {
  it("parses and validates club CSV rows", () => {
    expect(parseClubCsv(csv)).toEqual([
      expect.objectContaining({
        competition: "PL",
        club_name: "Test United",
        football_data_team_id: "123",
        aliases: "Test United FC|Test United"
      })
    ]);
  });

  it("imports clubs and venues idempotently", () => {
    const db = createDatabase();
    const dirname = fs.mkdtempSync(path.join(os.tmpdir(), "clubs-csv-"));
    const filename = path.join(dirname, "clubs.csv");
    fs.writeFileSync(filename, csv);

    expect(importClubCsv(db, filename)).toEqual({ rows: 1, imported: 1 });
    expect(importClubCsv(db, filename)).toEqual({ rows: 1, imported: 1 });

    const row = db.prepare(`
      SELECT c.name, c.football_data_team_id, c.aliases, v.name as venue_name, v.postcode
      FROM clubs c
      JOIN venues v ON v.id = c.venue_id
      WHERE c.name = 'Test United'
    `).get();

    expect(row).toEqual({
      name: "Test United",
      football_data_team_id: 123,
      aliases: "Test United FC|Test United",
      venue_name: "Test Ground",
      postcode: "AA1 1AA"
    });
  });
});
