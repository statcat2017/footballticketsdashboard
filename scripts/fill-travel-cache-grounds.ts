import { createSqliteAppDatabase } from "../lib/db/adapter.ts";
import { defaultDatabasePath, setupDatabase } from "../lib/db/setup.ts";
import { fillTravelCacheForGroundDistricts } from "../lib/travel/cache.ts";

const filename = process.env.SQLITE_DB_PATH ?? defaultDatabasePath;
async function main(): Promise<void> {
  const db = createSqliteAppDatabase(await setupDatabase(filename));

  try {
    const result = await fillTravelCacheForGroundDistricts(db, {
      openRouteServiceApiKey: process.env.OPENROUTESERVICE_API_KEY,
      travelTimeAppId: process.env.TRAVELTIME_APP_ID,
      travelTimeApiKey: process.env.TRAVELTIME_API_KEY
    });

    console.log(
      `ground travel prewarm complete: districts ${result.districtsConsidered}, inserted ${result.rowsInserted}, provider_backfilled ${result.providerBackfilled}, skipped ${result.distanceOnlySkipped}`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

main();
