import { NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME, adminCookieOptions, createAdminSessionCookieValue } from "@/lib/admin/auth";
import { getAdminConfig } from "@/lib/admin/config";
import { secureCompare } from "@/lib/admin/crypto";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { getDatabase } from "@/lib/db/client";
import { checkRateLimit, getRateLimitStatus, resetRateLimit } from "@/lib/rate-limit";
import { adminRedirect } from "@/lib/admin/redirect";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60_000;

function adminLoginRateLimitKey(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  const forwardedIp = request.headers.get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .find(Boolean);
  const ip = cfIp || forwardedIp || "unknown";

  return `admin-login:${ip}`;
}

function rateLimitedResponse(resetAt: number) {
  return NextResponse.json(
    { error: "Too many login attempts. Please try again later." },
    { status: 429, headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) } }
  );
}

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

  const rateLimitKey = adminLoginRateLimitKey(request);
  const rateLimitStatus = getRateLimitStatus(rateLimitKey, MAX_FAILED_LOGIN_ATTEMPTS, LOGIN_RATE_LIMIT_WINDOW_MS);

  if (!rateLimitStatus.allowed) {
    return rateLimitedResponse(rateLimitStatus.resetAt);
  }

  const secret = await readSecret(request);

  if (!secret || !secureCompare(secret, config.adminSecret)) {
    // Increment happens here; the next request will be blocked if the limit is now reached.
    const rateLimit = checkRateLimit(rateLimitKey, MAX_FAILED_LOGIN_ATTEMPTS, LOGIN_RATE_LIMIT_WINDOW_MS);

    if (!rateLimit.allowed) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    return NextResponse.json({ error: "Invalid admin secret." }, { status: 401 });
  }

  const cookieValue = await createAdminSessionCookieValue();

  await writeAdminAuditLog(await getDatabase(), {
    actor: "admin",
    action: "login",
    entityType: "admin_session",
    after: { result: "success" }
  });

  resetRateLimit(rateLimitKey);
  const response = adminRedirect(request, "/admin");
  response.cookies.set(ADMIN_COOKIE_NAME, cookieValue, adminCookieOptions());
  return response;
}
