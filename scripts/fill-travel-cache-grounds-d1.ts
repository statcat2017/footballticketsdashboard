import { fillTravelCacheForGroundDistricts } from "../lib/travel/cache.ts";
import { createD1AppDatabase, type AppDatabase, type QueryParam } from "../lib/db/adapter.ts";
import { createD1PreparedStatement, executeD1 } from "../lib/db/d1-exec.ts";

const databaseName = process.argv[2];

if (!databaseName) {
  console.error("Usage: node --experimental-strip-types scripts/fill-travel-cache-grounds-d1.ts <d1-database-name>");
  process.exit(1);
}

const db = createD1AppDatabase({
  prepare(query: string) {
    let boundValues: QueryParam[] = [];
    const stmt = {
      bind(...values: QueryParam[]) {
        boundValues = values;
        return stmt;
      },
      all<T>() {
        return createD1PreparedStatement(databaseName, query, boundValues).all<T>();
      },
      first<T>() {
        return createD1PreparedStatement(databaseName, query, boundValues).first<T>();
      },
      run() {
        return createD1PreparedStatement(databaseName, query, boundValues).run();
      }
    };
    return stmt;
  },
  async exec(query: string) {
    executeD1(databaseName, query);
  }
});

try {
  const result = await fillTravelCacheForGroundDistricts(db as AppDatabase, {
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
