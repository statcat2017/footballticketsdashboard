import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const e2eRunId = process.env.NEARMEFC_E2E_RUN_ID;
if (!e2eRunId) throw new Error("Run browser tests through `npm run test:e2e` to allocate isolated resources.");

const e2eDbDir = path.join(os.tmpdir(), `nearmefc-e2e-${e2eRunId}`);
const e2eWebPort = Number(process.env.NEARMEFC_E2E_PORT ?? 3217);
const e2eMockPort = Number(process.env.NEARMEFC_E2E_MOCK_PORT ?? e2eWebPort + 1);
const e2eDbPath = path.join(e2eDbDir, "nearmefc-e2e.sqlite");
process.env.E2E_DB_DIR = e2eDbDir;
process.env.SQLITE_DB_PATH = e2eDbPath;
process.env.NEARMEFC_E2E_MOCK_PORT = String(e2eMockPort);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  workers: 1,
  globalSetup: "./tests/e2e/globalSetup.ts",
  globalTeardown: "./tests/e2e/globalTeardown.ts",
  use: {
    baseURL: `http://127.0.0.1:${e2eWebPort}`,
    trace: "on-first-retry"
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${e2eWebPort}`,
    url: `http://127.0.0.1:${e2eWebPort}`,
    env: {
      SQLITE_DB_PATH: e2eDbPath,
      E2E_DB_DIR: e2eDbDir,
      POSTCODES_IO_BASE_URL: `http://127.0.0.1:${e2eMockPort}`,
      TFL_API_BASE_URL: `http://127.0.0.1:${e2eMockPort}/tfl`,
      PRICE_CONFIRMATION_MAX_AGE_DAYS: "90",
      OPENROUTESERVICE_API_KEY: "",
      TRAVELTIME_APP_ID: "",
      TRAVELTIME_API_KEY: ""
    },
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
