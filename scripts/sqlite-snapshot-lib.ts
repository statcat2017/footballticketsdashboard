import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const defaultDatabasePath = path.join(process.cwd(), "data", "nearmefc.sqlite");

const IMPORT_JOB_TABLES = [
  "fixture_sources",
  "import_batches",
  "import_batch_rows",
  "import_batch_issue_resolutions",
  "import_batch_row_actions"
] as const;

const FIXTURE_DIMENSIONS = ["source", "season_label", "status"] as const;

type GroupCount = { value: string | null; count: number };

export interface SqliteInventory {
  inspectedPath: string;
  capturedAt: string;
  sqliteVersion: string;
  journalMode: string;
  integrityCheck: string[];
  foreignKeyViolationCount: number;
  schemaVersion: {
    migrationCount: number | null;
    latestMigration: string | null;
  };
  tableCounts: Record<string, number>;
  fixtureCounts: Partial<Record<typeof FIXTURE_DIMENSIONS[number], GroupCount[]>>;
  importJobTablesPresent: string[];
}

export interface ProviderCredentialPresence {
  footballData: boolean;
  openRouteService: boolean;
  travelTime: boolean;
}

function canonicalPath(filename: string): string {
  const resolved = path.resolve(filename);
  if (fs.existsSync(resolved)) return fs.realpathSync(resolved);

  const parent = path.dirname(resolved);
  if (!fs.existsSync(parent)) return resolved;
  return path.join(fs.realpathSync(parent), path.basename(resolved));
}

function existingDatabasePath(filename: string): string {
  const resolved = path.resolve(filename);
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error(`SQLite source is not a regular file: ${resolved}`);
  return fs.realpathSync(resolved);
}

function assertNewIsolatedPath(filename: string, sourcePath: string): string {
  const destinationPath = canonicalPath(filename);
  const configuredPath = process.env.SQLITE_DB_PATH
    ? canonicalPath(process.env.SQLITE_DB_PATH)
    : null;
  const defaultPath = canonicalPath(defaultDatabasePath);

  if (destinationPath === sourcePath) {
    throw new Error("SQLite source and destination paths must be different.");
  }
  if (destinationPath === configuredPath || destinationPath === defaultPath) {
    throw new Error("Refusing to write to the configured application database path.");
  }
  const destinationFiles = [destinationPath, `${destinationPath}-wal`, `${destinationPath}-shm`];
  const existingDestinationFile = destinationFiles.find((candidate) => fs.existsSync(candidate));
  if (existingDestinationFile) {
    throw new Error(`Destination already exists; refusing to overwrite it: ${existingDestinationFile}`);
  }
  if (!fs.statSync(path.dirname(destinationPath)).isDirectory()) {
    throw new Error(`Destination parent is not a directory: ${path.dirname(destinationPath)}`);
  }
  return destinationPath;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

function tableNames(db: Database.Database): Set<string> {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
  return new Set(rows.map(({ name }) => name));
}

function columnsFor(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as { name: string }[];
  return new Set(rows.map(({ name }) => name));
}

function groupedFixtureCounts(db: Database.Database, tables: Set<string>): SqliteInventory["fixtureCounts"] {
  if (!tables.has("fixtures")) return {};

  const fixtureColumns = columnsFor(db, "fixtures");
  const result: SqliteInventory["fixtureCounts"] = {};
  for (const dimension of FIXTURE_DIMENSIONS) {
    if (!fixtureColumns.has(dimension)) continue;
    const rows = db.prepare(`
      SELECT ${quoteIdentifier(dimension)} AS value, COUNT(*) AS count
      FROM fixtures
      GROUP BY ${quoteIdentifier(dimension)}
      ORDER BY ${quoteIdentifier(dimension)}
    `).all() as { value: unknown; count: number }[];
    result[dimension] = rows.map(({ value, count }) => ({
      value: value === null ? null : String(value),
      count: Number(count)
    }));
  }
  return result;
}

export function inspectSqliteDatabase(filename: string): SqliteInventory {
  const databasePath = existingDatabasePath(filename);
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });

  try {
    const tables = tableNames(db);
    const tableCounts: Record<string, number> = {};
    for (const table of [...tables].filter((name) => !name.startsWith("sqlite_")).sort()) {
      tableCounts[table] = Number((db.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`).get() as { count: number }).count);
    }

    let migrationCount: number | null = null;
    let latestMigration: string | null = null;
    if (tables.has("_migrations")) {
      const migrationColumns = columnsFor(db, "_migrations");
      migrationCount = Number((db.prepare("SELECT COUNT(*) AS count FROM _migrations").get() as { count: number }).count);
      if (migrationColumns.has("id") && migrationColumns.has("name")) {
        const latest = db.prepare("SELECT name FROM _migrations ORDER BY id DESC LIMIT 1").get() as { name: string } | undefined;
        latestMigration = latest?.name ?? null;
      }
    }

    const integrityCheck = (db.pragma("integrity_check") as { integrity_check: string }[])
      .map(({ integrity_check }) => integrity_check);
    const foreignKeyViolationCount = (db.pragma("foreign_key_check") as unknown[]).length;
    const journalMode = String(db.pragma("journal_mode", { simple: true }));
    const sqliteVersion = String((db.prepare("SELECT sqlite_version() AS version").get() as { version: string }).version);

    return {
      inspectedPath: databasePath,
      capturedAt: new Date().toISOString(),
      sqliteVersion,
      journalMode,
      integrityCheck,
      foreignKeyViolationCount,
      schemaVersion: { migrationCount, latestMigration },
      tableCounts,
      fixtureCounts: groupedFixtureCounts(db, tables),
      importJobTablesPresent: IMPORT_JOB_TABLES.filter((table) => tables.has(table))
    };
  } finally {
    db.close();
  }
}

function assertConsistent(inventory: SqliteInventory): void {
  if (inventory.integrityCheck.length !== 1 || inventory.integrityCheck[0] !== "ok") {
    throw new Error(`SQLite integrity check failed: ${inventory.integrityCheck.join("; ") || "no result"}`);
  }
  if (inventory.foreignKeyViolationCount !== 0) {
    throw new Error(`SQLite foreign key check found ${inventory.foreignKeyViolationCount} violation(s).`);
  }
}

function reserveDestination(filename: string): { dev: number; ino: number } {
  const descriptor = fs.openSync(filename, "wx", 0o600);
  fs.closeSync(descriptor);
  const { dev, ino } = fs.statSync(filename);
  return { dev, ino };
}

function removeReservedDestination(filename: string, identity: { dev: number; ino: number }): void {
  try {
    const current = fs.statSync(filename);
    if (current.dev === identity.dev && current.ino === identity.ino) fs.rmSync(filename);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
}

async function writeConsistentCopy(sourceFilename: string, destinationFilename: string): Promise<SqliteInventory> {
  const sourcePath = existingDatabasePath(sourceFilename);
  const destinationPath = assertNewIsolatedPath(destinationFilename, sourcePath);
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  let destinationIdentity: { dev: number; ino: number } | null = null;

  try {
    destinationIdentity = reserveDestination(destinationPath);
    await source.backup(destinationPath);
    const inventory = inspectSqliteDatabase(destinationPath);
    assertConsistent(inventory);
    return inventory;
  } catch (error) {
    if (destinationIdentity) removeReservedDestination(destinationPath, destinationIdentity);
    throw error;
  } finally {
    source.close();
  }
}

export function createConsistentSqliteBackup(sourceFilename: string, backupFilename: string): Promise<SqliteInventory> {
  return writeConsistentCopy(sourceFilename, backupFilename);
}

export function restoreSqliteSnapshot(snapshotFilename: string, isolatedFilename: string): Promise<SqliteInventory> {
  return writeConsistentCopy(snapshotFilename, isolatedFilename);
}

export function providerCredentialPresence(env: NodeJS.ProcessEnv = process.env): ProviderCredentialPresence {
  return {
    footballData: Boolean(env.FOOTBALL_DATA_API_TOKEN),
    openRouteService: Boolean(env.OPENROUTESERVICE_API_KEY),
    travelTime: Boolean(env.TRAVELTIME_APP_ID && env.TRAVELTIME_API_KEY)
  };
}
