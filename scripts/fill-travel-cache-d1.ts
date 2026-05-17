import { fillTravelCacheForPostcode } from "../lib/travel/cache.ts";
import { createD1AppDatabase, type AppDatabase, type D1PreparedStatement, type QueryParam } from "../lib/db/adapter.ts";
import { executeD1, executeD1Json } from "../lib/db/d1-exec.ts";

const databaseName = process.argv[2];
const postcode = process.argv[3];
const dateFrom = process.argv[4];
const dateTo = process.argv[5];

if (!databaseName || !postcode) {
  console.error("Usage: node --experimental-strip-types scripts/fill-travel-cache-d1.ts <d1-database-name> <postcode> [date-from] [date-to]");
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
      async all<T>() {
        const parsed = await executeD1Json<T>(databaseName, query, boundValues);
        return { results: parsed.results ?? [] };
      },
      async first<T>() {
        const parsed = await executeD1Json<T>(databaseName, query, boundValues);
        return parsed.results?.[0] ?? null;
      },
      async run() {
        const parsed = await executeD1Json(databaseName, query, boundValues);
        return {
          success: true,
          meta: {
            last_row_id: parsed.meta?.last_row_id,
            changes: parsed.meta?.changes
          }
        };
      }
    };
    return stmt;
  },
  async exec(query: string) {
    executeD1(databaseName, query);
  },
  async batch(statements: D1PreparedStatement[]) {
    const results = [];

    for (const statement of statements) {
      results.push(await statement.run());
    }

    return results;
  },
  async transaction<T>(callback: (txn: any) => Promise<T>): Promise<T> {
    return callback(this);
  }
});

try {
  const result = await fillTravelCacheForPostcode(db as AppDatabase, postcode, {
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
