import { importFootballDataFixtures } from "../lib/db/footballDataImporter.ts";
import { createAppDatabase } from "../lib/db/client.ts";
import { defaultDatabasePath } from "../lib/db/setup.ts";

async function main(): Promise<void> {
  const filename = process.env.SQLITE_DB_PATH ?? defaultDatabasePath;
  const db = await createAppDatabase(filename);

  try {
    const result = await importFootballDataFixtures({ db });
    console.log(
      `football-data import complete: fetched ${result.fetched}, imported ${result.imported}, skipped ${result.skipped}`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

main();
