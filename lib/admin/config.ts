import { getEnv } from "@/lib/runtime-env";

export interface AdminConfig {
  adminSecret: string;
  sessionSecret: string;
}

export async function getAdminConfig(): Promise<AdminConfig | null> {
  const adminSecret = getEnv("ADMIN_SECRET");
  const sessionSecret = getEnv("ADMIN_SESSION_SECRET");

  if (!adminSecret || !sessionSecret) {
    return null;
  }

  return { adminSecret, sessionSecret };
}

export async function requireAdminConfig(): Promise<AdminConfig> {
  const config = await getAdminConfig();

  if (!config) {
    throw new Error("Admin is not configured.");
  }

  return config;
}
