import { defaultDatabasePath, setupDatabase } from "../lib/db/setup.ts";

async function main(): Promise<void> {
  const filename = process.env.SQLITE_DB_PATH ?? defaultDatabasePath;
  const db = await setupDatabase(filename);

  db.close();
  console.log(`SQLite database ready at ${filename}`);
}

main();
