import { createSqliteAppDatabase } from "../lib/db/adapter.ts";
import { defaultDatabasePath, setupDatabase } from "../lib/db/setup.ts";
import { fillTravelCacheForPostcode } from "../lib/travel/cache.ts";

const filename = process.env.SQLITE_DB_PATH ?? defaultDatabasePath;
const postcode = process.argv[2];
const dateFrom = process.argv[3];
const dateTo = process.argv[4];

if (!postcode) {
  console.error("Usage: node --experimental-strip-types scripts/fill-travel-cache.ts <postcode> [date-from] [date-to]");
  process.exit(1);
}

const db = createSqliteAppDatabase(setupDatabase(filename));

try {
  const result = await fillTravelCacheForPostcode(db, postcode, {
    dateFrom,
    dateTo,
    openRouteServiceApiKey: process.env.OPENROUTESERVICE_API_KEY,
    travelTimeAppId: process.env.TRAVELTIME_APP_ID,
    travelTimeApiKey: process.env.TRAVELTIME_API_KEY
  });

  console.log(
    `travel cache fill complete for ${result.postcodeDistrict}: considered ${result.venuesConsidered}, inserted ${result.rowsInserted}, provider_backfilled ${result.providerBackfilled}, skipped ${result.distanceOnlySkipped}`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
