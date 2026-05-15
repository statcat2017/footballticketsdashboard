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
  getDatabase.mockReset();
  writeAdminAuditLog.mockReset();
  vi.resetModules();
});

function configureAdmin() {
  process.env.ADMIN_SECRET = "test-admin-secret";
  process.env.ADMIN_SESSION_SECRET = "test-session-secret";
}

describe("admin auth routes", () => {
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
      action: "login",
      entityType: "admin_session",
      after: { result: "success" }
    });
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
});
