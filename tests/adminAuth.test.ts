import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_COOKIE_NAME, createAdminSessionCookieValue } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";

const getDatabase = vi.fn();
const writeAdminAuditLog = vi.fn();

vi.mock("@/lib/db/client", () => ({
  getDatabase
}));

vi.mock("@/lib/admin/audit", () => ({
  writeAdminAuditLog
}));

afterEach(() => {
  delete process.env.ADMIN_SECRET;
  delete process.env.ADMIN_SESSION_SECRET;
  vi.useRealTimers();
  getDatabase.mockReset();
  writeAdminAuditLog.mockReset();
  vi.resetModules();
});

function configureAdmin() {
  process.env.ADMIN_SECRET = "test-admin-secret";
  process.env.ADMIN_SESSION_SECRET = "test-session-secret";
}

function collectText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(collectText).join(" ");
  }

  if (typeof node === "object" && node !== null && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return collectText(props?.children);
  }

  return "";
}

describe("admin auth routes", () => {
  it("shows a generic unavailable message when admin login is not configured", async () => {
    const { default: AdminLoginPage } = await import("@/app/admin/login/page");

    const page = await AdminLoginPage();
    const text = collectText(page);

    expect(text).toContain("Admin access is unavailable.");
    expect(text).not.toContain("ADMIN_SECRET");
    expect(text).not.toContain("ADMIN_SESSION_SECRET");
  });

  it("shows the login form when admin login is configured", async () => {
    configureAdmin();
    const { default: AdminLoginPage } = await import("@/app/admin/login/page");

    const page = await AdminLoginPage();
    const text = collectText(page);

    expect(text).toContain("Admin secret");
    expect(text).toContain("Log in");
  });

  it("rejects login when admin is not configured", async () => {
    const { POST } = await import("@/app/api/admin/login/route");

    const response = await POST(new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: "anything" })
    }));

    expect(response.status).toBe(503);
  });

  it("rejects an invalid admin secret", async () => {
    configureAdmin();
    const { POST } = await import("@/app/api/admin/login/route");

    const response = await POST(new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: "wrong" })
    }));

    expect(response.status).toBe(401);
  });

  it("sets an HTTP-only admin cookie after a valid login", async () => {
    configureAdmin();
    const db = { kind: "db" };
    getDatabase.mockResolvedValue(db);
    const { POST } = await import("@/app/api/admin/login/route");

    const response = await POST(new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: "test-admin-secret" })
    }));

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/admin");
    expect(cookie).toContain(`${ADMIN_COOKIE_NAME}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=strict");
    expect(writeAdminAuditLog).toHaveBeenCalledWith(db, {
      actor: "admin",
      action: "login",
      entityType: "admin_session",
      after: { result: "success" }
    });
  });

  it("rate limits repeated failed admin login attempts", async () => {
    configureAdmin();
    const { POST } = await import("@/app/api/admin/login/route");

    for (let i = 0; i < 5; i += 1) {
      const response = await POST(new Request("http://localhost/api/admin/login", {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.10",
          "content-type": "application/json"
        },
        body: JSON.stringify({ secret: "wrong" })
      }));

      expect(response.status).toBe(401);
    }

    const blocked = await POST(new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "content-type": "application/json"
      },
      body: JSON.stringify({ secret: "wrong" })
    }));

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  it("resets failed admin login attempts after a successful login", async () => {
    configureAdmin();
    const db = { kind: "db" };
    getDatabase.mockResolvedValue(db);
    const { POST } = await import("@/app/api/admin/login/route");

    const failed = await POST(new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: {
        "cf-connecting-ip": "203.0.113.11",
        "content-type": "application/json"
      },
      body: JSON.stringify({ secret: "wrong" })
    }));
    expect(failed.status).toBe(401);

    const successful = await POST(new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: {
        "cf-connecting-ip": "203.0.113.11",
        "content-type": "application/json"
      },
      body: JSON.stringify({ secret: "test-admin-secret" })
    }));
    expect(successful.status).toBe(303);

    const nextFailure = await POST(new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: {
        "cf-connecting-ip": "203.0.113.11",
        "content-type": "application/json"
      },
      body: JSON.stringify({ secret: "wrong" })
    }));
    expect(nextFailure.status).toBe(401);
  });

  it("blocks even a correct admin secret while the failed-login window is active", async () => {
    vi.useFakeTimers({ now: new Date("2026-05-15T12:00:00.000Z") });
    configureAdmin();
    const db = { kind: "db" };
    getDatabase.mockResolvedValue(db);
    const { POST } = await import("@/app/api/admin/login/route");

    for (let i = 0; i < 5; i += 1) {
      await POST(new Request("http://localhost/api/admin/login", {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.12",
          "content-type": "application/json"
        },
        body: JSON.stringify({ secret: "wrong" })
      }));
    }

    const blocked = await POST(new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: {
        "cf-connecting-ip": "203.0.113.12",
        "content-type": "application/json"
      },
      body: JSON.stringify({ secret: "test-admin-secret" })
    }));
    expect(blocked.status).toBe(429);

    vi.advanceTimersByTime(15 * 60_000 + 1);

    const successful = await POST(new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: {
        "cf-connecting-ip": "203.0.113.12",
        "content-type": "application/json"
      },
      body: JSON.stringify({ secret: "test-admin-secret" })
    }));
    expect(successful.status).toBe(303);
  });

  it("falls back through client IP headers for admin login rate limiting", async () => {
    configureAdmin();
    const { POST } = await import("@/app/api/admin/login/route");

    for (let i = 0; i < 5; i += 1) {
      const response = await POST(new Request("http://localhost/api/admin/login", {
        method: "POST",
        headers: {
          "cf-connecting-ip": " ",
          "x-forwarded-for": " , 203.0.113.13",
          "content-type": "application/json"
        },
        body: JSON.stringify({ secret: "wrong" })
      }));
      expect(response.status).toBe(401);
    }

    const blocked = await POST(new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: {
        "x-forwarded-for": "203.0.113.13",
        "content-type": "application/json"
      },
      body: JSON.stringify({ secret: "wrong" })
    }));
    expect(blocked.status).toBe(429);
  });

  it("fails closed when successful login audit writing fails", async () => {
    configureAdmin();
    getDatabase.mockResolvedValue({ kind: "db" });
    writeAdminAuditLog.mockRejectedValue(new Error("audit failed"));
    const { POST } = await import("@/app/api/admin/login/route");

    await expect(POST(new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: "test-admin-secret" })
    }))).rejects.toThrow("audit failed");
  });

  it("requires an admin session before issuing a CSRF token", async () => {
    configureAdmin();
    const { GET } = await import("@/app/api/admin/csrf/route");

    const response = await GET(new Request("http://localhost/api/admin/csrf"));

    expect(response.status).toBe(401);
  });

  it("issues a CSRF token for an authenticated admin session", async () => {
    configureAdmin();
    const cookieValue = await createAdminSessionCookieValue();
    const { GET } = await import("@/app/api/admin/csrf/route");

    const response = await GET(new Request("http://localhost/api/admin/csrf", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${cookieValue}` }
    }));

    expect(response.status).toBe(200);
    const body = await response.json() as { csrfToken?: string };
    expect(typeof body.csrfToken).toBe("string");
  });

  it("rejects logout without a valid CSRF token", async () => {
    configureAdmin();
    const cookieValue = await createAdminSessionCookieValue();
    const { POST } = await import("@/app/api/admin/logout/route");

    const response = await POST(new Request("http://localhost/api/admin/logout", {
      method: "POST",
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${cookieValue}` }
    }));

    expect(response.status).toBe(403);
  });

  it("clears the admin cookie on logout with a valid CSRF token", async () => {
    configureAdmin();
    const db = { kind: "db" };
    getDatabase.mockResolvedValue(db);
    const cookieValue = await createAdminSessionCookieValue();
    const csrfToken = await createAdminCsrfToken();
    const { POST } = await import("@/app/api/admin/logout/route");
    const body = new FormData();
    body.set("csrf", csrfToken);

    const response = await POST(new Request("http://localhost/api/admin/logout", {
      method: "POST",
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${cookieValue}` },
      body
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login");
    expect(response.headers.get("set-cookie") ?? "").toContain("Max-Age=0");
    expect(writeAdminAuditLog).toHaveBeenCalledWith(db, {
      actor: "admin",
      action: "logout",
      entityType: "admin_session",
      after: { result: "success" }
    });
  });

  it("fails closed when logout audit writing fails", async () => {
    configureAdmin();
    getDatabase.mockResolvedValue({ kind: "db" });
    writeAdminAuditLog.mockRejectedValue(new Error("audit failed"));
    const cookieValue = await createAdminSessionCookieValue();
    const csrfToken = await createAdminCsrfToken();
    const { POST } = await import("@/app/api/admin/logout/route");
    const body = new FormData();
    body.set("csrf", csrfToken);

    await expect(POST(new Request("http://localhost/api/admin/logout", {
      method: "POST",
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${cookieValue}` },
      body
    }))).rejects.toThrow("audit failed");
  });
});
