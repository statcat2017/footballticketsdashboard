import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const e2eDbDir = path.join(os.tmpdir(), `nearmefc-e2e-${process.pid}`);
process.env.E2E_DB_DIR = e2eDbDir;
process.env.SQLITE_DB_PATH = path.join(e2eDbDir, "nearmefc-e2e.sqlite");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  globalSetup: "./tests/e2e/globalSetup.ts",
  globalTeardown: "./tests/e2e/globalTeardown.ts",
  use: {
    baseURL: "http://127.0.0.1:3217",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3217",
    url: "http://127.0.0.1:3217",
    env: {
      SQLITE_DB_PATH: process.env.SQLITE_DB_PATH,
      E2E_DB_DIR: process.env.E2E_DB_DIR,
      POSTCODES_IO_BASE_URL: "http://127.0.0.1:3218",
      TFL_API_BASE_URL: "http://127.0.0.1:3218/tfl",
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
