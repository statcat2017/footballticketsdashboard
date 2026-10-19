import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createServer } from "node:http";
import { setupDatabase } from "../../lib/db/setup.ts";
import { seedE2eFixtures } from "./seed.ts";

const DIR_PREFIX = "nearmefc-e2e-";
const DB_NAME = "nearmefc-e2e.sqlite";

async function globalSetup(): Promise<() => Promise<void>> {
  const configuredDir = process.env.E2E_DB_DIR;
  const tmpDir = configuredDir ?? fs.mkdtempSync(path.join(os.tmpdir(), DIR_PREFIX));
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  const dbPath = process.env.SQLITE_DB_PATH ?? path.join(tmpDir, DB_NAME);
  const db = await setupDatabase(dbPath);
  seedE2eFixtures(db);
  db.close();
  process.env.SQLITE_DB_PATH = dbPath;
  process.env.E2E_DB_DIR = tmpDir;

  const postcodeMock = createServer((request, response) => {
    if (request.url?.startsWith("/tfl/")) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ journeys: [] }));
      return;
    }

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result: { latitude: 51.5074, longitude: -0.1278 } }));
  });
  await new Promise<void>((resolve) => postcodeMock.listen(3218, "127.0.0.1", resolve));
  process.env.POSTCODES_IO_BASE_URL = "http://127.0.0.1:3218";

  return () => new Promise<void>((resolve, reject) => {
    postcodeMock.close((error) => error ? reject(error) : resolve());
  });
}

export default globalSetup;
