import { createSignedToken, verifySignedToken } from "./crypto.ts";
import { requireAdminConfig } from "./config.ts";

export const ADMIN_CSRF_HEADER = "x-admin-csrf-token";
const CSRF_DURATION_SECONDS = 8 * 60 * 60;
const CSRF_KEY_PURPOSE = "csrf-v1:";

interface CsrfPayload {
  purpose: "admin-csrf";
  issuedAt: number;
  expiresAt: number;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function csrfSigningKey(configSessionSecret: string): string {
  return `${CSRF_KEY_PURPOSE}${configSessionSecret}`;
}

export async function createAdminCsrfToken(): Promise<string> {
  const config = await requireAdminConfig();
  const issuedAt = nowSeconds();

  return createSignedToken({
    purpose: "admin-csrf",
    issuedAt,
    expiresAt: issuedAt + CSRF_DURATION_SECONDS
  } satisfies CsrfPayload, csrfSigningKey(config.sessionSecret));
}

export async function verifyAdminCsrfToken(value: string | null | undefined): Promise<boolean> {
  if (!value) {
    return false;
  }

  const config = await requireAdminConfig();
  const payload = await verifySignedToken<CsrfPayload>(value, csrfSigningKey(config.sessionSecret));

  return Boolean(payload && payload.purpose === "admin-csrf" && payload.expiresAt > nowSeconds());
}

export async function requireAdminCsrf(request: Request): Promise<void> {
  const valid = await verifyAdminCsrfToken(request.headers.get(ADMIN_CSRF_HEADER));

  if (!valid) {
    throw new Error("Invalid CSRF token.");
  }
}
