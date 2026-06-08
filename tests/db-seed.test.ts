import { describe, expect, it } from "vitest";
import { createAppDatabase } from "@/lib/db/client";
import { initializeAppDatabase } from "@/lib/db/seed-data";

describe("database initialization", () => {
  it("initializes schema and seed data into sqlite", async () => {
    const db = await createAppDatabase(":memory:");
    await initializeAppDatabase(db);

    const clubs = await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM clubs");
    expect(clubs?.count).toBeGreaterThan(0);

    const competitions = await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM competitions");
    expect(competitions?.count).toBeGreaterThan(0);

    const venues = await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM venues");
    expect(venues?.count).toBeGreaterThan(0);

    const pyramid = await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM pyramid_divisions");
    expect(pyramid?.count).toBeGreaterThan(0);
  });
});
