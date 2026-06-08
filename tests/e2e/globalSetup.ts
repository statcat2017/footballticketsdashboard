import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { setupDatabase } from "../../lib/db/setup.ts";
import { seedE2eFixtures } from "./seed.ts";

const DIR_PREFIX = "nearmefc-e2e-";
const DB_NAME = "nearmefc-e2e.sqlite";

async function globalSetup(): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), DIR_PREFIX));
  const dbPath = path.join(tmpDir, DB_NAME);
  const db = await setupDatabase(dbPath);
  seedE2eFixtures(db);
  db.close();
  process.env.SQLITE_DB_PATH = dbPath;
  process.env.E2E_DB_DIR = tmpDir;
}

export default globalSetup;
