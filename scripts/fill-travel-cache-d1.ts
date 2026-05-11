import { execFileSync } from "node:child_process";

import { fillTravelCacheForPostcode } from "../lib/travel/cache.ts";
import { createD1AppDatabase, type AppDatabase, type QueryParam } from "../lib/db/adapter.ts";

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
    return {
      bind(...values: QueryParam[]) {
        return createPreparedStatement(databaseName, query, values);
      },
      all() {
        return createPreparedStatement(databaseName, query, []).all();
      },
      first() {
        return createPreparedStatement(databaseName, query, []).first();
      },
      run() {
        return createPreparedStatement(databaseName, query, []).run();
      }
    };
  },
  async exec(query: string) {
    execute(databaseName, query);
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

function createPreparedStatement(databaseNameValue: string, query: string, values: QueryParam[]) {
  return {
    bind(...boundValues: QueryParam[]) {
      return createPreparedStatement(databaseNameValue, query, boundValues);
    },
    async all<T>() {
      const parsed = executeJson<T>(databaseNameValue, query, values);
      return { results: parsed.results ?? [] };
    },
    async first<T>() {
      const parsed = executeJson<T>(databaseNameValue, query, values);
      return parsed.results?.[0] ?? null;
    },
    async run() {
      const parsed = executeJson(databaseNameValue, query, values);
      return {
        success: true,
        meta: {
          last_row_id: parsed.meta?.last_row_id,
          changes: parsed.meta?.changes
        }
      };
    }
  };
}

function execute(name: string, sql: string) {
  execFileSync("npx", ["wrangler", "d1", "execute", name, "--remote", "--command", sql], {
    stdio: "inherit"
  });
}

function executeJson<T>(name: string, sql: string, params: QueryParam[]) {
  const output = execFileSync("npx", [
    "wrangler",
    "d1",
    "execute",
    name,
    "--remote",
    "--json",
    "--command",
    interpolateSql(sql, params)
  ], {
    encoding: "utf8"
  });
  const parsed = JSON.parse(output) as Array<{
    results?: T[];
    meta?: {
      changes?: number;
      last_row_id?: number;
    };
  }>;

  return parsed[0] ?? {};
}

function interpolateSql(sql: string, params: QueryParam[]): string {
  let index = 0;

  return sql.replace(/\?/g, () => escapeSqlValue(params[index++]));
}

function escapeSqlValue(value: QueryParam): string {
  if (value === null) {
    return "NULL";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  return `'${value.replaceAll("'", "''")}'`;
}
