import type { AppDatabase } from "@/lib/db/adapter";
import type { TravelProviderRuntimeConfig } from "@/lib/runtime-env";
import type { SearchRequest } from "@/lib/types";
import { fillTravelCacheForPostcode } from "@/lib/travel/cache";

function travelProviderConfig() {
  return {
    openRouteServiceApiKey: process.env.OPENROUTESERVICE_API_KEY,
    travelTimeAppId: process.env.TRAVELTIME_APP_ID,
    travelTimeApiKey: process.env.TRAVELTIME_API_KEY
  };
}

export function scheduleSearchTravelBackfill(
  db: AppDatabase,
  request: Required<Pick<SearchRequest, "postcode" | "dateFrom" | "dateTo">>,
  travelProviders?: TravelProviderRuntimeConfig
): void {
  const config = travelProviders ?? travelProviderConfig();

  if (!hasAnyTravelProviderConfig(config)) {
    return;
  }

  queueMicrotask(() => {
    void fillTravelCacheForPostcode(db, request.postcode, {
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
      ...config
    }).catch((error) => {
      console.error("travel cache backfill failed", error);
    });
  });
}

function hasAnyTravelProviderConfig(config: TravelProviderRuntimeConfig): boolean {
  return Boolean(
    config.openRouteServiceApiKey ||
    (config.travelTimeAppId && config.travelTimeApiKey)
  );
}
