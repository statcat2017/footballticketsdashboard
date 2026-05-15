import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createSignedToken, verifySignedToken } from "./crypto.ts";
import { requireAdminConfig } from "./config.ts";

export const ADMIN_COOKIE_NAME = "nearmefc_admin";
export const ADMIN_ACTOR = "admin";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

export interface AdminSession {
  actor: string;
  issuedAt: number;
  expiresAt: number;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function createAdminSessionCookieValue(): Promise<string> {
  const config = await requireAdminConfig();
  const issuedAt = nowSeconds();

  return createSignedToken({
    actor: ADMIN_ACTOR,
    issuedAt,
    expiresAt: issuedAt + SESSION_DURATION_SECONDS
  } satisfies AdminSession, config.sessionSecret);
}

export async function verifyAdminSessionCookieValue(value: string | undefined): Promise<AdminSession | null> {
  if (!value) {
    return null;
  }

  const config = await requireAdminConfig();
  const session = await verifySignedToken<AdminSession>(value, config.sessionSecret);

  if (!session || session.actor !== ADMIN_ACTOR || session.expiresAt <= nowSeconds()) {
    return null;
  }

  return session;
}

export async function getAdminSessionFromRequest(request: Request): Promise<AdminSession | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`));

  return verifyAdminSessionCookieValue(cookie?.slice(ADMIN_COOKIE_NAME.length + 1));
}

export async function getAdminSessionFromCookies(): Promise<AdminSession | null> {
  const store = await cookies();
  return verifyAdminSessionCookieValue(store.get(ADMIN_COOKIE_NAME)?.value);
}

export async function requireAdminSessionFromRequest(request: Request): Promise<AdminSession> {
  const session = await getAdminSessionFromRequest(request);

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

export async function requireAdminPageSession(): Promise<AdminSession> {
  const session = await getAdminSessionFromCookies();

  if (!session) {
    redirect("/admin/login");
  }

  return session;
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS
  };
}

export function expiredAdminCookieOptions() {
  return {
    ...adminCookieOptions(),
    maxAge: 0
  };
}
