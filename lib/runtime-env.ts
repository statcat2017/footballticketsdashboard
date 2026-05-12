import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface TravelProviderRuntimeConfig {
  openRouteServiceApiKey?: string;
  travelTimeAppId?: string;
  travelTimeApiKey?: string;
}

const MISSING_CONTEXT_CODE = "ERR_MISSING_CLOUDFLARE_CONTEXT";

function isMissingCloudflareContextError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === MISSING_CONTEXT_CODE) {
    return true;
  }

  return error instanceof Error && error.message.includes("getCloudflareContext");
}

export async function getCloudflareEnv(key: string): Promise<string | undefined> {
  try {
    const context = await getCloudflareContext({ async: true });
    const env = context.env as unknown as Record<string, string | undefined>;
    return env[key] ?? process.env[key];
  } catch (error) {
    if (!isMissingCloudflareContextError(error)) {
      throw error;
    }
    return process.env[key];
  }
}

export async function getTravelProviderRuntimeConfig(): Promise<TravelProviderRuntimeConfig> {
  try {
    const context = await getCloudflareContext({ async: true });
    const env = context.env as Partial<CloudflareEnv>;

    return {
      openRouteServiceApiKey: env.OPENROUTESERVICE_API_KEY ?? process.env.OPENROUTESERVICE_API_KEY,
      travelTimeAppId: env.TRAVELTIME_APP_ID ?? process.env.TRAVELTIME_APP_ID,
      travelTimeApiKey: env.TRAVELTIME_API_KEY ?? process.env.TRAVELTIME_API_KEY
    };
  } catch (error) {
    if (!isMissingCloudflareContextError(error)) {
      throw error;
    }

    return {
      openRouteServiceApiKey: process.env.OPENROUTESERVICE_API_KEY,
      travelTimeAppId: process.env.TRAVELTIME_APP_ID,
      travelTimeApiKey: process.env.TRAVELTIME_API_KEY
    };
  }
}
