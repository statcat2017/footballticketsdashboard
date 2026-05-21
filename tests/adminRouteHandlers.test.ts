import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSqliteAppDatabase } from "@/lib/db/adapter";
import type { AppDatabase } from "@/lib/db/adapter";
import { applySchema } from "@/lib/db/setup";

vi.mock("@/lib/admin/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/auth")>("@/lib/admin/auth");
  return {
    ...actual,
    getAdminSessionFromRequest: vi.fn().mockResolvedValue({ user: "test-admin" })
  };
});

const mockVerifyCsrf = vi.fn().mockResolvedValue(true);

vi.mock("@/lib/admin/csrf", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/csrf")>("@/lib/admin/csrf");
  return {
    ...actual,
    verifyAdminCsrfToken: mockVerifyCsrf
  };
});

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn<() => Promise<AppDatabase>>()
}));

vi.mock("@/lib/db/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/client")>("@/lib/db/client");
  return { ...actual, getDatabase };
});

function createAdminRouteDb(): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  applySchema(sqlite);
  const db = createSqliteAppDatabase(sqlite);

  db.exec(`
    INSERT INTO pyramid_templates (id, code, name, sport, status)
    VALUES (1, 'mens', 'Men''s English Pyramid', 'mens', 'active');

    INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size)
    VALUES (10, 1, 'premier', 'Premier Division', 1, 20);

    INSERT INTO pyramid_seasons (id, template_id, season_label)
    VALUES (1, 1, '2025-26');

    INSERT INTO clubs (id, name, aliases, status, source_url, verified_at)
    VALUES (100, 'Test Town United', NULL, 'known', NULL, NULL);

    INSERT INTO division_assignments (club_id, division_id)
    VALUES (100, 10);

    INSERT INTO venues (id, name, postcode, latitude, longitude)
    VALUES
      (50, 'Test Park', 'TE1 1ST', 51.5, -0.1),
      (51, 'City Ground', 'CT1 2AB', 52.0, -0.2);

    INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary)
    VALUES (100, 100, 50, '2025-08-01', NULL, 1);
  `);

  return db;
}

function buildFormRequest(path: string, fields: Record<string, string>): Request {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }

  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: formData
  });
}

describe("admin route handlers", () => {
  beforeEach(() => {
    mockVerifyCsrf.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    getDatabase.mockReset();
  });

  it("updates club fields from POST /api/admin/clubs/[id] form data", async () => {
    const db = createAdminRouteDb();
    getDatabase.mockResolvedValue(db);
    const { POST } = await import("@/app/api/admin/clubs/[id]/route");

    const response = await POST(
      buildFormRequest("/api/admin/clubs/100", {
        csrf: "test-csrf",
        name: "Test Town Renamed",
        aliases: "TTU, Town",
        status: "partial",
        source_url: "https://example.com/test-town",
        verified_at: "2026-05-20T12:00:00.000Z"
      }),
      { params: Promise.resolve({ id: "100" }) }
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/admin/clubs/100");

    const club = await db.get<{
      name: string;
      aliases: string | null;
      status: string;
      source_url: string | null;
      verified_at: string | null;
      admin_updated_at: string | null;
    }>(
      `SELECT name, aliases, status, source_url, verified_at, admin_updated_at
       FROM clubs WHERE id = 100`
    );

    expect(club).toMatchObject({
      name: "Test Town Renamed",
      aliases: "TTU, Town",
      status: "partial",
      source_url: "https://example.com/test-town",
      verified_at: "2026-05-20T12:00:00.000Z"
    });
    expect(club!.admin_updated_at).not.toBeNull();
  });

  it("creates a venue from POST /api/admin/venues form data", async () => {
    const db = createAdminRouteDb();
    getDatabase.mockResolvedValue(db);
    const { POST } = await import("@/app/api/admin/venues/route");

    const response = await POST(buildFormRequest("/api/admin/venues", {
      csrf: "test-csrf",
      name: "New Stadium",
      postcode: "NW1 4SA",
      latitude: "51.5007",
      longitude: "-0.1246",
      is_approximate: "1",
      coordinate_precision: "postcode"
    }));

    expect(response.status).toBe(303);

    const venue = await db.get<{
      id: number;
      name: string;
      postcode: string;
      latitude: number;
      longitude: number;
      is_approximate: number;
      coordinate_precision: string | null;
      admin_updated_at: string | null;
    }>("SELECT id, name, postcode, latitude, longitude, is_approximate, coordinate_precision, admin_updated_at FROM venues WHERE name = ?", ["New Stadium"]);

    expect(venue).toMatchObject({
      name: "New Stadium",
      postcode: "NW1 4SA",
      latitude: 51.5007,
      longitude: -0.1246,
      is_approximate: 1,
      coordinate_precision: "postcode"
    });
    expect(venue!.admin_updated_at).not.toBeNull();
    expect(response.headers.get("location")).toBe(`http://localhost/admin/venues/${venue!.id}`);
  });

  it("assigns a venue from POST /api/admin/assign-venue form data", async () => {
    const db = createAdminRouteDb();
    getDatabase.mockResolvedValue(db);
    const { POST } = await import("@/app/api/admin/assign-venue/route");

    const response = await POST(buildFormRequest("/api/admin/assign-venue", {
      csrf: "test-csrf",
      club_id: "100",
      venue_id: "51",
      effective_from: "2026-07-01"
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/admin/clubs/100");

    const previousAssignment = await db.get<{ effective_to: string | null }>(
      "SELECT effective_to FROM club_venue_assignments WHERE id = 100"
    );
    expect(previousAssignment!.effective_to).toBe("2026-06-30");

    const newAssignment = await db.get<{
      venue_id: number;
      effective_from: string;
      effective_to: string | null;
      is_primary: number;
    }>(
      `SELECT venue_id, effective_from, effective_to, is_primary
       FROM club_venue_assignments
       WHERE club_id = 100 AND id != 100`
    );

    expect(newAssignment).toMatchObject({
      venue_id: 51,
      effective_from: "2026-07-01",
      effective_to: null,
      is_primary: 1
    });
  });

  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrf.mockResolvedValue(false);
    const db = createAdminRouteDb();
    getDatabase.mockResolvedValue(db);
    const { POST } = await import("@/app/api/admin/clubs/[id]/route");

    const response = await POST(
      buildFormRequest("/api/admin/clubs/100", {
        csrf: "bad-csrf",
        name: "Should Not Update"
      }),
      { params: Promise.resolve({ id: "100" }) }
    );

    expect(response.status).toBe(403);
  });

  it("redirects with error when club ID does not exist", async () => {
    const db = createAdminRouteDb();
    getDatabase.mockResolvedValue(db);
    const { POST } = await import("@/app/api/admin/clubs/[id]/route");

    const response = await POST(
      buildFormRequest("/api/admin/clubs/99999", {
        csrf: "test-csrf",
        name: "Test"
      }),
      { params: Promise.resolve({ id: "99999" }) }
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("error=");
  });
});
