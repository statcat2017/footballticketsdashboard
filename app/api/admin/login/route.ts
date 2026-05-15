import { NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME, adminCookieOptions, createAdminSessionCookieValue } from "@/lib/admin/auth";
import { getAdminConfig } from "@/lib/admin/config";
import { secureCompare } from "@/lib/admin/crypto";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { getDatabase } from "@/lib/db/client";

async function readSecret(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as { secret?: unknown } | null;
    return typeof body?.secret === "string" ? body.secret : null;
  }

  const form = await request.formData().catch(() => null);
  const secret = form?.get("secret");
  return typeof secret === "string" ? secret : null;
}

export async function POST(request: Request) {
  const config = await getAdminConfig();

  if (!config) {
    return NextResponse.json({ error: "Admin is not configured." }, { status: 503 });
  }

  const secret = await readSecret(request);

  if (!secret || !secureCompare(secret, config.adminSecret)) {
    return NextResponse.json({ error: "Invalid admin secret." }, { status: 401 });
  }

  const cookieValue = await createAdminSessionCookieValue();

  await writeAdminAuditLog(await getDatabase(), {
    action: "login",
    entityType: "admin_session",
    after: { result: "success" }
  });

  const response = NextResponse.redirect(new URL("/admin", request.url), { status: 303 });
  response.cookies.set(ADMIN_COOKIE_NAME, cookieValue, adminCookieOptions());
  return response;
}
