import { setupDatabase } from "../../lib/db/setup.ts";
import { seedE2eFixtures } from "./seed.ts";
import { e2eDatabasePath, removeE2eDatabaseFiles } from "./databasePath.ts";

async function globalSetup(): Promise<void> {
  removeE2eDatabaseFiles();
  const db = await setupDatabase(e2eDatabasePath);
  seedE2eFixtures(db);
  db.close();
  process.env.SQLITE_DB_PATH = e2eDatabasePath;
}

export default globalSetup;
