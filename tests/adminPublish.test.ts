import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applySchema } from "@/lib/db/setup";
import { createSqliteAppDatabase } from "@/lib/db/adapter";
import type { AppDatabase } from "@/lib/db/adapter";

vi.mock("@/lib/admin/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/auth")>("@/lib/admin/auth");
  return {
    ...actual,
    getAdminSessionFromRequest: vi.fn().mockResolvedValue({}),
    requireAdminPageSession: vi.fn().mockResolvedValue({})
  };
});

vi.mock("@/lib/admin/csrf", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/csrf")>("@/lib/admin/csrf");
  return {
    ...actual,
    verifyAdminCsrfToken: vi.fn().mockResolvedValue(true),
    createAdminCsrfToken: vi.fn().mockResolvedValue("test-csrf")
  };
});

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn<() => Promise<AppDatabase>>()
}));

vi.mock("@/lib/db/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/client")>("@/lib/db/client");
  return { ...actual, getDatabase };
});

function createPublishTestDb(opts?: {
  publishExistingClub?: boolean;
  existingClubWrongCompetition?: boolean;
  existingClubWrongVenue?: boolean;
  existingClubAlreadyMapped?: boolean;
  noDivisionMapping?: boolean;
  noVenue?: boolean;
}): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  applySchema(sqlite);
  const db = createSqliteAppDatabase(sqlite);

  db.exec(`
    INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Men''s English Pyramid', 'mens', 'active');
    INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (10, 1, 'premier', 'Premier Division', 1, 20);
    INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (1, 1, '2025-26');
    INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES (10, 1, 1, 10, 'open');
    INSERT INTO pyramid_clubs (id, name, status) VALUES (100, 'Test Town United', 'known');
    INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (100, 1, 1, 10, 100);
    INSERT INTO competitions (code, name, tier) VALUES ('PL', 'Premier League', 1);
  `);

  if (!opts?.noVenue) {
    db.exec(`
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'Test Park', 'TE1 1ST', 51.5, -0.1);
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (51, 'Other Ground', 'OT1 1AB', 52.0, -0.2);
      INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES (100, 100, 50, '2025-08-01', NULL, 1);
    `);
  }

  if (!opts?.noDivisionMapping) {
    db.exec(`INSERT INTO division_competition_mappings (id, division_id, competition_code) VALUES (1, 10, 'PL');`);
  }

  if (opts?.existingClubWrongCompetition) {
    db.exec(`INSERT INTO competitions (code, name, tier) VALUES ('ELC', 'Championship', 2);`);
  }

  if (opts?.publishExistingClub) {
    const compCode = opts.existingClubWrongCompetition ? "'ELC'" : "'PL'";
    const vId = opts.existingClubWrongVenue ? "51" : "50";
    db.exec(
      `INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (200, 'Test Town United', ${compCode}, ${vId});`
    );
  }

  if (opts?.existingClubAlreadyMapped) {
    db.exec(
      `INSERT INTO pyramid_clubs (id, name, status) VALUES (99, 'Other FC', 'known');
       INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (200, 1, 1, 10, 99);
       INSERT INTO clubs (id, name, competition_code, venue_id) VALUES (200, 'Test Town United', 'PL', 50);
       INSERT INTO club_mappings (pyramid_club_id, club_id) VALUES (99, 200);`
    );
  }

  return db;
}

describe("admin publish route", () => {
  afterEach(() => {
    getDatabase.mockReset();
  });

  it("publishes a new club (inserts clubs, club_mappings, audit)", async () => {
    const db = createPublishTestDb();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("pyramid_club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "");
    expect(location).toContain("success=Club");

    const club = await db.get<{ id: number; name: string; competition_code: string; venue_id: number }>(
      "SELECT id, name, competition_code, venue_id FROM clubs WHERE name = ?", ["Test Town United"]
    );
    expect(club).toBeDefined();
    expect(club!.competition_code).toBe("PL");
    expect(club!.venue_id).toBe(50);

    const mapping = await db.get<{ id: number }>(
      "SELECT id FROM club_mappings WHERE pyramid_club_id = 100"
    );
    expect(mapping).toBeDefined();

    const audit = await db.get<{ action: string; entity_type: string }>(
      "SELECT action, entity_type FROM admin_audit_log WHERE entity_type = 'club' AND action = 'publish'"
    );
    expect(audit).toBeDefined();
  });

  it("maps existing public club instead of creating duplicate", async () => {
    const db = createPublishTestDb({ publishExistingClub: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("pyramid_club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "");
    expect(location).toContain("mapped to existing public club");

    const clubs = await db.all<{ id: number }>(
      "SELECT id FROM clubs WHERE name = 'Test Town United'"
    );
    expect(clubs).toHaveLength(1);

    const mapping = await db.get<{ id: number }>(
      "SELECT id FROM club_mappings WHERE pyramid_club_id = 100"
    );
    expect(mapping).toBeDefined();

    const audit = await db.get<{ action: string; entity_type: string }>(
      "SELECT action, entity_type FROM admin_audit_log WHERE entity_type = 'club_mapping' AND action = 'publish'"
    );
    expect(audit).toBeDefined();
  });

  it("blocks when existing public club has wrong competition_code", async () => {
    const db = createPublishTestDb({
      publishExistingClub: true,
      existingClubWrongCompetition: true
    });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("pyramid_club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "");
    expect(location).toContain("error=");
    expect(location).toContain("competition");
  });

  it("blocks when existing public club has wrong venue_id", async () => {
    const db = createPublishTestDb({
      publishExistingClub: true,
      existingClubWrongVenue: true
    });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("pyramid_club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "");
    expect(location).toContain("error=");
    expect(location).toContain("venue");
  });

  it("blocks when existing public club is already mapped to another pyramid club", async () => {
    const db = createPublishTestDb({ existingClubAlreadyMapped: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("pyramid_club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "");
    expect(location).toContain("error=");
    expect(location).toContain("already mapped");
  });

  it("blocks when division has no competition mapping", async () => {
    const db = createPublishTestDb({ noDivisionMapping: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("pyramid_club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "");
    expect(location).toContain("Publish the competition first");
  });

  it("blocks when club has no primary venue", async () => {
    const db = createPublishTestDb({ noVenue: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("pyramid_club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "");
    expect(location).toContain("Create a venue first");
  });
});
