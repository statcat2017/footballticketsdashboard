import { describe, expect, it } from "vitest";

import { createCorrection } from "@/lib/corrections";
import { createDatabase } from "@/lib/db/client";

describe("corrections", () => {
  it("stores correction submissions as pending", () => {
    const db = createDatabase();

    const correction = createCorrection(db, {
      fixtureId: 1,
      clubName: "Chelsea",
      priceText: "Adult tickets should be from £35",
      sourceUrl: "https://example.com/prices"
    });

    const row = db.prepare("SELECT status, price_text FROM corrections WHERE id = ?").get(correction.id) as {
      status: string;
      price_text: string;
    };

    expect(row.status).toBe("pending");
    expect(row.price_text).toBe("Adult tickets should be from £35");
  });
});
