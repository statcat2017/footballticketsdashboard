import type { AppDatabase } from "@/lib/db/adapter";
import type { TravelProviderRuntimeConfig } from "@/lib/runtime-env";
import { getCloudflareEnv } from "@/lib/runtime-env";
import type { SearchRequest } from "@/lib/types";
import { fillTravelCacheForPostcode } from "@/lib/travel/cache";

async function travelProviderConfig(): Promise<TravelProviderRuntimeConfig> {
  return {
    openRouteServiceApiKey: await getCloudflareEnv("OPENROUTESERVICE_API_KEY"),
    travelTimeAppId: await getCloudflareEnv("TRAVELTIME_APP_ID"),
    travelTimeApiKey: await getCloudflareEnv("TRAVELTIME_API_KEY")
  };
}

export async function scheduleSearchTravelBackfill(
  db: AppDatabase,
  request: Required<Pick<SearchRequest, "postcode" | "dateFrom" | "dateTo">>,
  travelProviders?: TravelProviderRuntimeConfig
): Promise<void> {
  const config = travelProviders ?? await travelProviderConfig();

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
