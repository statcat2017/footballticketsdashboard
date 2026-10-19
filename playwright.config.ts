import { defineConfig, devices } from "@playwright/test";
import { e2eDatabasePath } from "./tests/e2e/databasePath";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  globalSetup: "./tests/e2e/globalSetup.ts",
  globalTeardown: "./tests/e2e/globalTeardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    timezoneId: "Pacific/Honolulu"
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    env: {
      SQLITE_DB_PATH: e2eDatabasePath,
      POSTCODES_IO_BASE_URL: "http://127.0.0.1:9",
      TZ: "Asia/Tokyo"
    },
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
