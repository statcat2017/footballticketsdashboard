import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createConsistentSqliteBackup,
  inspectSqliteDatabase,
  providerCredentialPresence,
  restoreSqliteSnapshot
} from "./sqlite-snapshot-lib.ts";

function printReport(operation: string, inventory: Awaited<ReturnType<typeof inspectSqliteDatabase>>, sourcePath?: string): void {
  console.log(JSON.stringify({
    operation,
    nodeVersion: process.version,
    providerCredentialPresence: providerCredentialPresence(),
    sourcePath,
    ...inventory
  }, null, 2));
}

export async function runSnapshotCommand(args: string[]): Promise<void> {
  const [operation, sourcePath, destinationPath, extra] = args;
  if (extra !== undefined) throw new Error("Too many arguments.");

  if (operation === "inspect" && sourcePath && !destinationPath) {
    printReport("inspect", inspectSqliteDatabase(sourcePath));
    return;
  }
  if (operation === "backup" && sourcePath && destinationPath) {
    printReport("backup", await createConsistentSqliteBackup(sourcePath, destinationPath), sourcePath);
    return;
  }
  if (operation === "restore" && sourcePath && destinationPath) {
    printReport("restore", await restoreSqliteSnapshot(sourcePath, destinationPath), sourcePath);
    return;
  }

  throw new Error([
    "Usage:",
    "  npm run db:snapshot -- inspect <sqlite-file>",
    "  npm run db:snapshot -- backup <source-sqlite-file> <new-snapshot-file>",
    "  npm run db:snapshot -- restore <snapshot-file> <new-isolated-sqlite-file>"
  ].join("\n"));
}

const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (scriptPath && fileURLToPath(import.meta.url) === scriptPath) {
  runSnapshotCommand(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
