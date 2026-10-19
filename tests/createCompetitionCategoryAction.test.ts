import type { AppDatabase } from "@/lib/db/adapter";
import { createSqliteAppDatabase } from "@/lib/db/adapter";
import { createBatch, createSource } from "@/lib/import";
import { setupDatabase } from "@/lib/db/setup";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actionState = vi.hoisted(() => ({ database: null as AppDatabase | null }));

vi.mock("@/lib/db/client", () => ({
  getDatabase: async () => actionState.database
}));

vi.mock("@/lib/admin/auth", () => ({
  getAdminSessionFromCookies: async () => ({ actor: "test-operator" })
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

import { createCompetition, updateCompetitionCategory } from "@/app/admin/imports/[id]/actions";
import { searchFixtures } from "@/lib/search/service";

let sqlite: Awaited<ReturnType<typeof setupDatabase>> | null = null;
let db: AppDatabase;
let testDirectory: string | null = null;

beforeEach(async () => {
  sqlite = await setupDatabase(":memory:");
  db = createSqliteAppDatabase(sqlite);
  actionState.database = db;
});

afterEach(() => {
  sqlite?.close();
  sqlite = null;
  actionState.database = null;
  if (testDirectory) fs.rmSync(testDirectory, { recursive: true, force: true });
  testDirectory = null;
});

describe("competition creation public category", () => {
  it("stores the operator-selected category for a newly created competition", async () => {
    const source = await createSource(db, { sourceType: "csv_paste", name: "Test source" });
    const batch = await createBatch(db, { sourceId: source.id, adapterType: "csv_paste", actor: "test-operator" });
    const form = new FormData();
    form.set("code", "WOM_PREM");
    form.set("name", "Women Premier League");
    form.set("kind", "league");
    form.set("tier", "1");
    form.set("publicCategory", "womens");

    const result = await createCompetition(batch.id, null, form);

    expect(result).toEqual({ success: 'Competition "Women Premier League" created.' });
    await expect(db.get<{ public_category: string }>(
      "SELECT public_category FROM competitions WHERE code = 'WOM_PREM'"
    )).resolves.toEqual({ public_category: "womens" });
  });

  it("updates an existing category with an audit entry and exposes it after reopening SQLite", async () => {
    testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "competition-category-action-"));
    sqlite?.close();
    sqlite = await setupDatabase(path.join(testDirectory, "app.sqlite"));
    db = createSqliteAppDatabase(sqlite);
    actionState.database = db;

    const source = await createSource(db, { sourceType: "csv_paste", name: "Test source" });
    const batch = await createBatch(db, { sourceId: source.id, adapterType: "csv_paste", actor: "test-operator" });
    await db.run(`
      INSERT INTO competitions (code, name, tier, kind, public_category)
      VALUES ('TESTCAT', 'Test Category', 4, 'league', 'uncategorized')
    `);
    await db.run(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, fixture_date, kickoff_time, status, is_demo_data, is_historical
      ) VALUES (
        'test', 'category-update', 'TESTCAT', 1, 2, 1,
        '2031-05-12T19:00:00.000Z', '2031-05-12', '20:00', 'scheduled', 0, 0
      )
    `);

    const form = new FormData();
    form.set("competitionCode", "TESTCAT");
    form.set("publicCategory", "efl");
    await expect(updateCompetitionCategory(batch.id, null, form)).resolves.toEqual({
      success: 'Competition "Test Category" category updated.'
    });
    await expect(db.get<{ action: string; actor: string; before_json: string; after_json: string }>(
      "SELECT action, actor, before_json, after_json FROM admin_audit_log WHERE entity_type = 'competition' AND entity_id = 'TESTCAT' ORDER BY id DESC LIMIT 1"
    )).resolves.toMatchObject({
      action: "update",
      actor: "test-operator",
      before_json: expect.stringContaining("uncategorized"),
      after_json: expect.stringContaining("efl")
    });

    sqlite.close();
    sqlite = await setupDatabase(path.join(testDirectory, "app.sqlite"));
    db = createSqliteAppDatabase(sqlite);
    actionState.database = db;
    const results = await searchFixtures(db, {
      postcode: "SW6 1HS",
      dateFrom: "2031-05-12",
      dateTo: "2031-05-12"
    }, {
      postcodeResolver: { resolve: async () => ({ latitude: 51.4817, longitude: -0.191 }) },
      travelProviderOverrides: []
    });

    expect(results.find((result) => result.competitionCode === "TESTCAT")?.competitionCategory).toBe("efl");
  });
});
