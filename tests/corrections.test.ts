import { describe, expect, it } from "vitest";

import { createCorrection } from "@/lib/corrections";
import { createAppDatabase } from "@/lib/db/client";

describe("corrections", () => {
  it("stores correction submissions as pending", async () => {
    const db = createAppDatabase();

    const correction = await createCorrection(db, {
      fixtureId: 1,
      clubName: "Chelsea",
      priceText: "Adult tickets should be from £35",
      sourceUrl: "https://example.com/prices"
    });

    const row = await db.get<{
      status: string;
      price_text: string;
    }>("SELECT status, price_text FROM corrections WHERE id = ?", [correction.id]);

    expect(row?.status).toBe("pending");
    expect(row?.price_text).toBe("Adult tickets should be from £35");
  });
});
