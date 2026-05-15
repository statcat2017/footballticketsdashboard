import { NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME, expiredAdminCookieOptions, getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { getDatabase } from "@/lib/db/client";

export async function POST(request: Request) {
  const session = await getAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const csrf = form?.get("csrf");

  if (typeof csrf !== "string" || !(await verifyAdminCsrfToken(csrf))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  await writeAdminAuditLog(await getDatabase(), {
    actor: session.actor,
    action: "logout",
    entityType: "admin_session",
    after: { result: "success" }
  });

  const response = NextResponse.redirect(new URL("/admin/login", request.url), { status: 303 });
  response.cookies.set(ADMIN_COOKIE_NAME, "", expiredAdminCookieOptions());
  return response;
}
