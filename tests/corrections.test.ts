import { afterEach, describe, expect, it, vi } from "vitest";

import { createCorrection } from "@/lib/corrections";
import { createAppDatabase } from "@/lib/db/client";

import type { AppDatabase } from "@/lib/db/adapter";

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 3600_000 }),
  };
});

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn<() => Promise<AppDatabase>>(),
}));

vi.mock("@/lib/db/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/client")>("@/lib/db/client");
  return { ...actual, getDatabase };
});

describe("corrections", () => {
  afterEach(() => { getDatabase.mockReset(); });

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

import { checkRateLimit } from "@/lib/rate-limit";

describe("corrections API route", () => {
  afterEach(() => {
    getDatabase.mockReset();
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 3600_000 });
  });

  it("accepts valid submission with all fields", async () => {
    const db = createAppDatabase();
    await db.run(`INSERT INTO fixtures (source, source_id, competition_code, home_club_id, away_club_id, venue_id, kickoff_at, status, is_demo_data, is_historical)
      VALUES ('test', 'corr-test', 'PL', 1, 2, 1, '2026-06-01T15:00:00.000Z', 'scheduled', 0, 0)`);
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/corrections/route");
    const response = await POST(new Request("http://localhost/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fixtureId: 1,
        clubName: "Chelsea",
        email: "fan@example.com",
        priceText: "Adult tickets should be from £35",
        sourceUrl: "https://example.com/prices",
        message: "I went last week"
      })
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ status: "pending" });
    expect(body.id).toBeGreaterThan(0);
  });

  it("accepts minimal submission with just priceText", async () => {
    const db = createAppDatabase();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/corrections/route");
    const response = await POST(new Request("http://localhost/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceText: "Should be £15" })
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ status: "pending" });
  });

  it("rejects empty body with 400", async () => {
    const db = createAppDatabase();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/corrections/route");
    const response = await POST(new Request("http://localhost/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  it("rejects missing priceText with 400", async () => {
    const db = createAppDatabase();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/corrections/route");
    const response = await POST(new Request("http://localhost/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId: 1 })
    }));

    expect(response.status).toBe(400);
  });

  it("rejects invalid email with 400", async () => {
    const db = createAppDatabase();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/corrections/route");
    const response = await POST(new Request("http://localhost/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceText: "£15", email: "not-an-email" })
    }));

    expect(response.status).toBe(400);
  });

  it("accepts empty string email as if omitted", async () => {
    const db = createAppDatabase();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/corrections/route");
    const response = await POST(new Request("http://localhost/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceText: "£15", email: "" })
    }));

    expect(response.status).toBe(201);
  });

  it("rejects too-short priceText with 400", async () => {
    const db = createAppDatabase();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/corrections/route");
    const response = await POST(new Request("http://localhost/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceText: "A" })
    }));

    expect(response.status).toBe(400);
  });

  it("throws 429 when rate limited", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 3600_000 });

    const db = createAppDatabase();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/corrections/route");
    const response = await POST(new Request("http://localhost/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceText: "£15" })
    }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
  });

  it("throws on database errors", async () => {
    const db = createAppDatabase();
    vi.spyOn(db, "run").mockRejectedValue(new Error("DB gone"));
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/corrections/route");
    await expect(POST(new Request("http://localhost/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceText: "£15" })
    }))).rejects.toThrow("DB gone");
  });

  it("accepts fixtureId as string (coerced by zod)", async () => {
    const db = createAppDatabase();
    await db.run(`INSERT INTO fixtures (source, source_id, competition_code, home_club_id, away_club_id, venue_id, kickoff_at, status, is_demo_data, is_historical)
      VALUES ('test', 'corr-coerce', 'PL', 1, 2, 1, '2026-06-01T15:00:00.000Z', 'scheduled', 0, 0)`);
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/corrections/route");
    const response = await POST(new Request("http://localhost/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId: "1", priceText: "£20" })
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBeGreaterThan(0);
  });

  it("preserves submitted data in the database", async () => {
    const db = createAppDatabase();
    const result = await db.run(`INSERT INTO fixtures (source, source_id, competition_code, home_club_id, away_club_id, venue_id, kickoff_at, status, is_demo_data, is_historical)
      VALUES ('test', 'corr-preserve', 'PL', 1, 2, 1, '2026-06-01T15:00:00.000Z', 'scheduled', 0, 0)`);
    const fixtureId = Number(result.lastInsertRowid);
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/corrections/route");
    await POST(new Request("http://localhost/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fixtureId,
        clubName: "Liverpool",
        email: "fan@lfc.tv",
        priceText: "Kids go free",
        sourceUrl: "https://lfc.tv/prices",
        message: "Great offer"
      })
    }));

    const row = await db.get<{ fixture_id: number; club_name: string; price_text: string; status: string }>(
      "SELECT fixture_id, club_name, price_text, status FROM corrections ORDER BY id DESC LIMIT 1"
    );

    expect(row?.fixture_id).toBe(fixtureId);
    expect(row?.club_name).toBe("Liverpool");
    expect(row?.price_text).toBe("Kids go free");
    expect(row?.status).toBe("pending");
  });
});
