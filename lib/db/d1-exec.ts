import { execFileSync } from "node:child_process";
import type { QueryParam } from "./adapter.ts";
import { escapeSqlValue } from "./sql.ts";

export function createD1PreparedStatement(databaseName: string, query: string, values: QueryParam[]) {
  return {
    bind(...boundValues: QueryParam[]) {
      return createD1PreparedStatement(databaseName, query, boundValues);
    },
    async all<T>() {
      const parsed = executeD1Json<T>(databaseName, query, values);
      return { results: parsed.results ?? [] };
    },
    async first<T>() {
      const parsed = executeD1Json<T>(databaseName, query, values);
      return parsed.results?.[0] ?? null;
    },
    async run() {
      const parsed = executeD1Json(databaseName, query, values);
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

export function executeD1(name: string, sql: string) {
  execFileSync("npx", ["wrangler", "d1", "execute", name, "--remote", "--command", sql], {
    stdio: "inherit"
  });
}

export function executeD1Json<T>(name: string, sql: string, params: QueryParam[]) {
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
  let result = "";
  let inString = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (inString) {
      if (ch === "'") {
        if (i + 1 < sql.length && sql[i + 1] === "'") {
          result += "''";
          i++;
        } else {
          inString = false;
          result += "'";
        }
      } else {
        result += ch;
      }
    } else {
      if (ch === "'") {
        inString = true;
        result += "'";
      } else if (ch === "?") {
        result += escapeSqlValue(params[index++]);
      } else {
        result += ch;
      }
    }
  }

  return result;
}
