export interface TravelProviderRuntimeConfig {
  openRouteServiceApiKey?: string;
  travelTimeAppId?: string;
  travelTimeApiKey?: string;
}

export async function getCloudflareEnv(key: string): Promise<string | undefined> {
  return process.env[key];
}

export async function getTravelProviderRuntimeConfig(): Promise<TravelProviderRuntimeConfig> {
  return {
    openRouteServiceApiKey: process.env.OPENROUTESERVICE_API_KEY,
    travelTimeAppId: process.env.TRAVELTIME_APP_ID,
    travelTimeApiKey: process.env.TRAVELTIME_API_KEY,
  };
}