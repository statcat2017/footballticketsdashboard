import { removeE2eDatabaseFiles } from "./databasePath.ts";

async function globalTeardown(): Promise<void> {
  removeE2eDatabaseFiles();
}

export default globalTeardown;
