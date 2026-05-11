import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface TravelProviderRuntimeConfig {
  openRouteServiceApiKey?: string;
  travelTimeAppId?: string;
  travelTimeApiKey?: string;
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
  } catch {
    return {
      openRouteServiceApiKey: process.env.OPENROUTESERVICE_API_KEY,
      travelTimeAppId: process.env.TRAVELTIME_APP_ID,
      travelTimeApiKey: process.env.TRAVELTIME_API_KEY
    };
  }
}
