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

describe("D1 production compatibility (no transaction API)", () => {
  afterEach(() => {
    getDatabase.mockReset();
  });

  function createNoTransactionDb(opts?: Parameters<typeof createPublishTestDb>[0]): AppDatabase {
    const base = createPublishTestDb(opts);
    return {
      ...base,
      transaction: vi.fn().mockRejectedValue(new Error("D1 transaction API is not available in this context."))
    };
  }

  it("publishes new club via writeBatch when transaction is unavailable", async () => {
    const db = createNoTransactionDb();
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

    const mapping = await db.get<{ id: number }>(
      "SELECT id FROM club_mappings WHERE pyramid_club_id = 100"
    );
    expect(mapping).toBeDefined();
  });

  it("maps existing public club via writeBatch when transaction is unavailable", async () => {
    const db = createNoTransactionDb({ publishExistingClub: true });
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
  });
});

describe("admin publish redirect_division_id", () => {
  afterEach(() => {
    getDatabase.mockReset();
  });

  it("club publish redirect includes ?division_id when redirect_division_id is provided", async () => {
    const db = createPublishTestDb();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("pyramid_club_id", "100");
    formData.append("redirect_division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("division_id=10");
    expect(location).toContain("success=Club");
  });

  it("club publish error redirect includes ?division_id when redirect_division_id is provided", async () => {
    const db = createPublishTestDb({ noVenue: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("pyramid_club_id", "100");
    formData.append("redirect_division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("division_id=10");
    expect(location).toContain("error=");
  });
});

describe("admin publish competition route", () => {
  afterEach(() => {
    getDatabase.mockReset();
  });

  function createCompetitionTestDb(opts?: {
    existingCompetition?: boolean;
    nationalLeague?: boolean;
    noTransaction?: boolean;
  }): AppDatabase {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    applySchema(sqlite);
    const db = createSqliteAppDatabase(sqlite);

    const level = opts?.nationalLeague ? 5 : 1;
    const divName = opts?.nationalLeague ? "National League" : "Premier Division";

    db.exec(`
      INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Men''s English Pyramid', 'mens', 'active');
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (10, 1, 'test-div', '${divName}', ${level}, 20);
      INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (1, 1, '2025-26');
      INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES (10, 1, 1, 10, 'open');
    `);

    if (opts?.existingCompetition) {
      db.exec(`INSERT INTO competitions (code, name, tier) VALUES ('PREMIER_DI', 'Premier Division', 1);`);
    }

    if (opts?.noTransaction) {
      return {
        ...db,
        transaction: vi.fn().mockRejectedValue(
          new Error("D1 transaction API is not available in this context.")
        )
      };
    }

    return db;
  }

  it("publishes a new competition", async () => {
    const db = createCompetitionTestDb();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/competition/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/competition", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "");
    expect(location).toContain("published as");

    const competition = await db.get<{ code: string; name: string; tier: number }>(
      "SELECT code, name, tier FROM competitions WHERE code != 'PL'"
    );
    expect(competition).toBeDefined();
    expect(competition!.tier).toBe(1);

    const mapping = await db.get<{ id: number }>(
      "SELECT id FROM division_competition_mappings WHERE division_id = 10"
    );
    expect(mapping).toBeDefined();
  });

  it("national league (tier 5) publishes successfully with expanded tier constraint", async () => {
    const db = createCompetitionTestDb({ nationalLeague: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/competition/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/competition", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "");
    expect(location).toContain("published as");

    const competition = await db.get<{ code: string; tier: number }>(
      "SELECT code, tier FROM competitions WHERE code = 'NL'"
    );
    expect(competition).toBeDefined();
    expect(competition!.tier).toBe(5);
  });

  it("maps to existing competition when code already exists", async () => {
    const db = createCompetitionTestDb({ existingCompetition: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/competition/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/competition", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "");
    expect(location).toContain("mapped to existing competition");

    const competitions = await db.all<{ code: string }>(
      "SELECT code FROM competitions"
    );
    expect(competitions).toHaveLength(1);
  });

  it("publishes competition via writeBatch when transaction is unavailable", async () => {
    const db = createCompetitionTestDb({ noTransaction: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/competition/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/competition", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "");
    expect(location).toContain("published as");

    const mapping = await db.get<{ id: number }>(
      "SELECT id FROM division_competition_mappings WHERE division_id = 10"
    );
    expect(mapping).toBeDefined();
  });

  it("redirect includes ?division_id when redirect_division_id is provided", async () => {
    const db = createCompetitionTestDb();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/competition/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("division_id", "10");
    formData.append("redirect_division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/competition", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "");
    expect(location).toContain("division_id=10");
    expect(location).toContain("published as");
  });
});

describe("admin publish clubs tier-10 migration", () => {
  it("applies the 015 migration and allows tier 5", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    applySchema(sqlite);

    // Use raw better-sqlite3 to avoid async wrapper issues
    sqlite.exec(`INSERT INTO competitions (code, name, tier) VALUES ('NL', 'National League', 5)`);

    const row = sqlite.prepare("SELECT tier FROM competitions WHERE code = 'NL'").get() as { tier: number } | undefined;
    expect(row).toBeDefined();
    expect(row!.tier).toBe(5);
  });

  it("rejects tier outside 1-10 range after migration", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    applySchema(sqlite);

    expect(() => {
      sqlite.exec(`INSERT INTO competitions (code, name, tier) VALUES ('BAD', 'Bad League', 11)`);
    }).toThrow();
  });
});

describe("getPublishableClubs with division filter", () => {
  afterEach(() => {
    getDatabase.mockReset();
  });

  it("returns only clubs for the specified division", async () => {
    const mod = await import("@/lib/admin/clubs");

    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    applySchema(sqlite);
    const rawDb = createSqliteAppDatabase(sqlite);

    // Division 10 with club 100 and Division 20 with club 200
    rawDb.exec(`
      INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (1, 'mens', 'Men''s English Pyramid', 'mens', 'active');
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (10, 1, 'div-a', 'Division A', 1, 20);
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (20, 1, 'div-b', 'Division B', 2, 20);
      INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (1, 1, '2025-26');
      INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES (10, 1, 1, 10, 'open');
      INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES (20, 1, 1, 20, 'open');
      INSERT INTO pyramid_clubs (id, name, status) VALUES (100, 'Town FC', 'known');
      INSERT INTO pyramid_clubs (id, name, status) VALUES (200, 'Other Town', 'known');
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (100, 1, 1, 10, 100);
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (200, 1, 1, 20, 200);
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'Town Park', 'TE1 1ST', 51.5, -0.1);
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (99, 'Other Park', 'OT1 1AB', 52.0, -0.2);
      INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES (100, 100, 50, '2025-08-01', NULL, 1);
      INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES (200, 200, 99, '2025-08-01', NULL, 1);
      INSERT INTO competitions (code, name, tier) VALUES ('PL', 'Premier League', 1);
      INSERT INTO division_competition_mappings (id, division_id, competition_code) VALUES (1, 10, 'PL');
      INSERT INTO division_competition_mappings (id, division_id, competition_code) VALUES (2, 20, 'PL');
    `);

    getDatabase.mockResolvedValue(rawDb);

    const allClubs = await mod.getPublishableClubs();
    expect(allClubs.length).toBeGreaterThanOrEqual(2);

    const filteredClubs = await mod.getPublishableClubs(10);
    expect(filteredClubs.every((c) => c.divisionId === 10)).toBe(true);
    expect(filteredClubs.length).toBeLessThan(allClubs.length);
  });
});
