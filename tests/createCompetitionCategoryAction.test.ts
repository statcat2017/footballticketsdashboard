import type { AppDatabase } from "@/lib/db/adapter";
import { createSqliteAppDatabase } from "@/lib/db/adapter";
import { createBatch, createSource } from "@/lib/import";
import { setupDatabase } from "@/lib/db/setup";
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

import { createCompetition } from "@/app/admin/imports/[id]/actions";

let sqlite: Awaited<ReturnType<typeof setupDatabase>> | null = null;
let db: AppDatabase;

beforeEach(async () => {
  sqlite = await setupDatabase(":memory:");
  db = createSqliteAppDatabase(sqlite);
  actionState.database = db;
});

afterEach(() => {
  sqlite?.close();
  sqlite = null;
  actionState.database = null;
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
});
