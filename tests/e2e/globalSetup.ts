import fs from "node:fs";
import { createServer } from "node:http";
import { setupDatabase } from "../../lib/db/setup.ts";
import { seedE2eFixtures } from "./seed.ts";

async function globalSetup(): Promise<() => Promise<void>> {
  const tmpDir = process.env.E2E_DB_DIR;
  const dbPath = process.env.SQLITE_DB_PATH;
  const mockPort = Number(process.env.NEARMEFC_E2E_MOCK_PORT);
  if (!tmpDir || !dbPath || !Number.isInteger(mockPort)) {
    throw new Error("Playwright did not configure isolated E2E SQLite and provider mock settings.");
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  const db = await setupDatabase(dbPath);
  seedE2eFixtures(db);
  db.close();

  const providerMocks = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url?.startsWith("/tfl/")) {
      response.end(JSON.stringify({ journeys: [] }));
      return;
    }
    response.end(JSON.stringify({ result: { latitude: 51.4817, longitude: -0.191 } }));
  });
  await new Promise<void>((resolve, reject) => {
    providerMocks.once("error", reject);
    providerMocks.listen(mockPort, "127.0.0.1", resolve);
  });

  return () => new Promise<void>((resolve, reject) => {
    providerMocks.close((error) => error ? reject(error) : resolve());
  });
}

export default globalSetup;
