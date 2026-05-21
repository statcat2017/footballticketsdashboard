import { defaultDatabasePath, setupDatabase } from "../lib/db/setup.ts";

const filename = process.env.SQLITE_DB_PATH ?? defaultDatabasePath;
const db = setupDatabase(filename);

db.close();
console.log(`SQLite database ready at ${filename}`);
