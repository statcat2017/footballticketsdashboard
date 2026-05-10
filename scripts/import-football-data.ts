import { importFootballDataFixtures } from "../lib/db/footballDataImporter.ts";
import { defaultDatabasePath, setupDatabase } from "../lib/db/setup.ts";

const filename = process.env.SQLITE_DB_PATH ?? defaultDatabasePath;
const db = setupDatabase(filename);

try {
  const result = await importFootballDataFixtures({ db });
  console.log(
    `football-data import complete: fetched ${result.fetched}, imported ${result.imported}, skipped ${result.skipped}`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}
