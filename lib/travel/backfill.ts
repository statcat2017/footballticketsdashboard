import type { AppDatabase } from "../db/adapter.ts";
import type { TravelProviderRuntimeConfig } from "../runtime-env.ts";
import { getTravelProviderRuntimeConfig } from "../runtime-env.ts";
import type { SearchRequest } from "../types.ts";
import { fillTravelCacheForPostcode } from "./cache.ts";

export async function scheduleSearchTravelBackfill(
  db: AppDatabase,
  request: Required<Pick<SearchRequest, "postcode" | "dateFrom" | "dateTo">>,
  travelProviders?: TravelProviderRuntimeConfig
): Promise<void> {
  const config = travelProviders ?? await getTravelProviderRuntimeConfig();

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
