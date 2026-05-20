import Database from "better-sqlite3";
import { renderToStaticMarkup } from "react-dom/server";
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
  existingClubWrongCompetition?: boolean;
  noDivisionMapping?: boolean;
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
    INSERT INTO competitions (code, name, tier) VALUES ('PL', 'Premier League', 1);
  `);

  if (opts?.existingClubWrongCompetition) {
    db.exec(`INSERT INTO competitions (code, name, tier) VALUES ('ELC', 'Championship', 2);`);
  }

  const compCode = opts?.existingClubWrongCompetition ? "'ELC'" : "NULL";

  db.exec(`
    INSERT INTO clubs (id, name, status, competition_code) VALUES (100, 'Test Town United', 'known', ${compCode});
    INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (100, 1, 1, 10, 100);
    INSERT INTO division_assignments (club_id, division_id) VALUES (100, 10);
    INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'Test Park', 'TE1 1ST', 51.5, -0.1);
    INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES (100, 100, 50, '2025-08-01', NULL, 1);
  `);

  if (!opts?.noDivisionMapping) {
    db.exec(`INSERT INTO division_competition_mappings (id, division_id, competition_code) VALUES (1, 10, 'PL');`);
  }

  return db;
}

describe("admin publish route", () => {
  afterEach(() => {
    getDatabase.mockReset();
  });

  it("publishes a club (updates clubs, audit)", async () => {
    const db = createPublishTestDb();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("success=Club");
    expect(location).toContain("published.");

    const club = await db.get<{ id: number; name: string; competition_code: string; status: string }>(
      "SELECT id, name, competition_code, status FROM clubs WHERE id = 100"
    );
    expect(club).toBeDefined();
    expect(club!.competition_code).toBe("PL");
    expect(club!.status).toBe("known");

    const audit = await db.get<{ action: string; entity_type: string }>(
      "SELECT action, entity_type FROM admin_audit_log WHERE entity_type = 'club' AND action = 'publish'"
    );
    expect(audit).toBeDefined();
  });

  it("returns already published when club has correct competition_code and status", async () => {
    const db = createPublishTestDb();
    getDatabase.mockResolvedValue(db);

    // Pre-set the club to already match
    db.exec("UPDATE clubs SET competition_code = 'PL' WHERE id = 100");

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("success");
    expect(location).toContain("already published");

    const clubs = await db.all<{ id: number }>(
      "SELECT id FROM clubs WHERE name = 'Test Town United'"
    );
    expect(clubs).toHaveLength(1);
  });

  it("updates competition_code when club has a different competition_code", async () => {
    const db = createPublishTestDb({ existingClubWrongCompetition: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("success");
    expect(location).toContain("published");

    const club = await db.get<{ competition_code: string }>(
      "SELECT competition_code FROM clubs WHERE id = 100"
    );
    expect(club!.competition_code).toBe("PL");
  });

  it("blocks when division has no competition mapping", async () => {
    const db = createPublishTestDb({ noDivisionMapping: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("Publish the competition first");
  });

  it("publishes from division_assignments rather than season memberships", async () => {
    const db = createPublishTestDb();
    getDatabase.mockResolvedValue(db);

    db.exec(`
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (11, 1, 'current', 'Current Division', 2, 20);
      INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status) VALUES (11, 1, 1, 11, 'open');
      INSERT INTO competitions (code, name, tier) VALUES ('CUR', 'Current League', 2);
      INSERT INTO division_competition_mappings (id, division_id, competition_code) VALUES (2, 11, 'CUR');
      UPDATE division_assignments SET division_id = 11 WHERE club_id = 100;
    `);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const club = await db.get<{ competition_code: string }>(
      "SELECT competition_code FROM clubs WHERE id = 100"
    );
    expect(club!.competition_code).toBe("CUR");
  });

  it("does not publish friendly-only assigned clubs", async () => {
    const db = createPublishTestDb();
    getDatabase.mockResolvedValue(db);

    db.exec(`
      INSERT INTO competitions (code, name, tier, kind) VALUES ('FRIENDLY', 'Friendlies', 10, 'friendly');
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, venue_id,
        fixture_date, status, is_demo_data, is_historical, away_one_off, away_one_off_name
      ) VALUES (
        'test', 'friendly-only', 'FRIENDLY', 100, 50,
        '2025-08-01', 'scheduled', 0, 0, 1, 'Friendly Opponent'
      );
    `);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("Friendly clubs cannot be published");

    const club = await db.get<{ competition_code: string | null }>(
      "SELECT competition_code FROM clubs WHERE id = 100"
    );
    expect(club!.competition_code).toBeNull();
  });
});

describe("admin publish page messages", () => {
  afterEach(() => {
    getDatabase.mockReset();
  });

  it("renders warning query parameter", async () => {
    const db = createPublishTestDb();
    getDatabase.mockResolvedValue(db);

    const { default: AdminPublishPage } = await import("@/app/admin/publish/page");
    const html = renderToStaticMarkup(await AdminPublishPage({
      searchParams: Promise.resolve({ warning: "Division is at capacity." })
    }));

    expect(html).toContain("Division is at capacity.");
  });

  it("assignment route redirects with warning while saving over-capacity assignment", async () => {
    const db = createPublishTestDb();
    getDatabase.mockResolvedValue(db);

    await db.exec(`
      UPDATE pyramid_divisions SET max_size = 1 WHERE id = 10;
      INSERT INTO clubs (id, name, status) VALUES (200, 'Overflow FC', 'known');
    `);

    const { POST } = await import("@/app/api/admin/assign-club/route");
    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("club_id", "200");
    formData.append("division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/assign-club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("warning=");
    expect(location).toContain("at capacity");

    const assignment = await db.get<{ division_id: number }>(
      "SELECT division_id FROM division_assignments WHERE club_id = 200"
    );
    expect(assignment?.division_id).toBe(10);
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

  it("publishes club via writeBatch when transaction is unavailable", async () => {
    const db = createNoTransactionDb();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("success=Club");
    expect(location).toContain("published.");

    const club = await db.get<{ competition_code: string }>(
      "SELECT competition_code FROM clubs WHERE id = 100"
    );
    expect(club!.competition_code).toBe("PL");
  });

  it("returns already published via writeBatch when transaction is unavailable", async () => {
    const db = createNoTransactionDb();
    getDatabase.mockResolvedValue(db);

    // Pre-set the club to already match
    db.exec("UPDATE clubs SET competition_code = 'PL' WHERE id = 100");

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("club_id", "100");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("already published");

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
    formData.append("club_id", "100");
    formData.append("redirect_division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("/admin/publish/10");
    expect(location).toContain("success=Club");
  });

  it("club publish error redirect includes ?division_id when redirect_division_id is provided", async () => {
    const db = createPublishTestDb({ noDivisionMapping: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/club/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("club_id", "100");
    formData.append("redirect_division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/club", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/admin/publish/10");
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
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
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
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
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
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
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
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
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
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("/admin/publish/10");
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

describe("admin publish clubs bulk route", () => {
  afterEach(() => {
    getDatabase.mockReset();
  });

  function createBulkTestDb(opts?: {
    oneAlreadyPublished?: boolean;
    noCompetitionMapping?: boolean;
    noTransaction?: boolean;
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
      INSERT INTO competitions (code, name, tier) VALUES ('PL', 'Premier League', 1);
    `);

    const alphaCompCode = opts?.oneAlreadyPublished ? "'PL'" : "NULL";

    db.exec(`
      INSERT INTO clubs (id, name, status, competition_code) VALUES (100, 'Alpha Town', 'known', ${alphaCompCode});
      INSERT INTO clubs (id, name, status, competition_code) VALUES (101, 'Beta City', 'known', NULL);
      INSERT INTO clubs (id, name, status, competition_code) VALUES (102, 'Gamma United', 'known', NULL);
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (100, 1, 1, 10, 100);
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (101, 1, 1, 10, 101);
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (102, 1, 1, 10, 102);
      INSERT INTO division_assignments (club_id, division_id) VALUES (100, 10);
      INSERT INTO division_assignments (club_id, division_id) VALUES (101, 10);
      INSERT INTO division_assignments (club_id, division_id) VALUES (102, 10);
    `);

    if (!opts?.noCompetitionMapping) {
      db.exec(`INSERT INTO division_competition_mappings (id, division_id, competition_code) VALUES (1, 10, 'PL');`);
    }

    // All three clubs get a primary venue by default
    db.exec(`
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (50, 'Alpha Park', 'TE1 1ST', 51.5, -0.1);
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (51, 'Beta Ground', 'TE2 2ND', 52.0, -0.2);
      INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (52, 'Gamma Stadium', 'TE3 3RD', 53.0, -0.3);
      INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES (100, 100, 50, '2025-08-01', NULL, 1);
      INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES (101, 101, 51, '2025-08-01', NULL, 1);
      INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES (102, 102, 52, '2025-08-01', NULL, 1);
    `);

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

  it("publishes multiple new clubs in one batch", async () => {
    const db = createBulkTestDb();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/clubs/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/clubs", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("Published 3 clubs");

    const clubsCount = await db.get<{ c: number }>("SELECT COUNT(*) as c FROM clubs");
    expect(clubsCount!.c).toBe(3);

    const audit = await db.all<{ id: number }>("SELECT id FROM admin_audit_log");
    expect(audit).toHaveLength(3);
  });

  it("publishes clubs and skips already published entries", async () => {
    const db = createBulkTestDb({ oneAlreadyPublished: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/clubs/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/clubs", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("Published 2 clubs");
    expect(location).toContain("Already published");
  });

  it("rejects when division has no competition mapping", async () => {
    const db = createBulkTestDb({ noCompetitionMapping: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/clubs/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/clubs", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("Publish the competition first");
  });

  it("bulk publishes only clubs assigned to the division_assignments division", async () => {
    const db = createBulkTestDb();
    getDatabase.mockResolvedValue(db);

    db.exec(`
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (11, 1, 'other', 'Other Division', 2, 20);
      UPDATE division_assignments SET division_id = 11 WHERE club_id = 102;
    `);

    const { POST } = await import("@/app/api/admin/publish/clubs/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/clubs", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("Published 2 clubs");

    const gamma = await db.get<{ competition_code: string | null }>(
      "SELECT competition_code FROM clubs WHERE id = 102"
    );
    expect(gamma!.competition_code).toBeNull();
  });

  it("bulk publish skips friendly assigned clubs", async () => {
    const db = createBulkTestDb();
    getDatabase.mockResolvedValue(db);

    db.exec(`
      INSERT INTO competitions (code, name, tier, kind) VALUES ('FRIENDLY', 'Friendlies', 10, 'friendly');
      UPDATE clubs SET competition_code = 'FRIENDLY' WHERE id = 102;
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, venue_id,
        fixture_date, status, is_demo_data, is_historical, away_one_off, away_one_off_name
      ) VALUES (
        'test', 'friendly-only', 'FRIENDLY', 101, 51,
        '2025-08-01', 'scheduled', 0, 0, 1, 'Friendly Opponent'
      );
    `);

    const { POST } = await import("@/app/api/admin/publish/clubs/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/clubs", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("Published 1 club");

    const beta = await db.get<{ competition_code: string | null }>(
      "SELECT competition_code FROM clubs WHERE id = 101"
    );
    const gamma = await db.get<{ competition_code: string | null }>(
      "SELECT competition_code FROM clubs WHERE id = 102"
    );
    expect(beta!.competition_code).toBeNull();
    expect(gamma!.competition_code).toBe("FRIENDLY");
  });

  it("redirect preserves division_id", async () => {
    const db = createBulkTestDb();
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/clubs/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("division_id", "10");
    formData.append("redirect_division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/clubs", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("/admin/publish/10");
  });

  it("publishes via writeBatch when transaction is unavailable", async () => {
    const db = createBulkTestDb({ noTransaction: true });
    getDatabase.mockResolvedValue(db);

    const { POST } = await import("@/app/api/admin/publish/clubs/route");

    const formData = new FormData();
    formData.append("csrf", "test-csrf");
    formData.append("division_id", "10");
    const response = await POST(new Request("http://localhost/api/admin/publish/clubs", {
      method: "POST",
      body: formData
    }));

    expect(response.status).toBe(303);
    const location = decodeURIComponent(response.headers.get("location") ?? "").replace(/\+/g, " ");
    expect(location).toContain("Published");
  });
});
