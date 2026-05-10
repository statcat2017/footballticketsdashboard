import { importClubCsv } from "../lib/db/clubCsvImporter.ts";
import { defaultDatabasePath, setupDatabase } from "../lib/db/setup.ts";

const filename = process.env.SQLITE_DB_PATH ?? defaultDatabasePath;
const csvPath = process.argv[2] ?? "data/clubs.csv";
const db = setupDatabase(filename);

try {
  const result = importClubCsv(db, csvPath);
  console.log(`club import complete: imported ${result.imported} of ${result.rows} rows from ${csvPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}
