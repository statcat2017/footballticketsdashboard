import { DEFAULT_PRICE_CONFIRMATION_POLICY, type PriceConfirmationPolicy } from "./pricing/policy.ts";

export interface TravelProviderRuntimeConfig {
  openRouteServiceApiKey?: string;
  travelTimeAppId?: string;
  travelTimeApiKey?: string;
}

export function getEnv(key: string): string | undefined {
  return process.env[key];
}

export async function getTravelProviderRuntimeConfig(): Promise<TravelProviderRuntimeConfig> {
  return {
    openRouteServiceApiKey: process.env.OPENROUTESERVICE_API_KEY,
    travelTimeAppId: process.env.TRAVELTIME_APP_ID,
    travelTimeApiKey: process.env.TRAVELTIME_API_KEY,
  };
}

export function getPriceConfirmationPolicy(): PriceConfirmationPolicy {
  const value = process.env.PRICE_CONFIRMATION_MAX_AGE_DAYS;
  if (value === undefined || value.trim() === "") return DEFAULT_PRICE_CONFIRMATION_POLICY;

  const maxAgeDays = Number(value);
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0 || maxAgeDays > 3650) {
    return DEFAULT_PRICE_CONFIRMATION_POLICY;
  }

  return { maxAgeDays };
}
