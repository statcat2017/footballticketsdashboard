import { spawnSync } from "node:child_process";
import { randomInt, randomUUID } from "node:crypto";
import path from "node:path";

process.env.NEARMEFC_E2E_RUN_ID ??= randomUUID();
process.env.NEARMEFC_E2E_PORT ??= String(45000 + randomInt(0, 10000));
process.env.NEARMEFC_E2E_MOCK_PORT ??= String(Number(process.env.NEARMEFC_E2E_PORT) + 1);

const playwrightCli = path.resolve("node_modules/@playwright/test/cli.js");
const result = spawnSync(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
