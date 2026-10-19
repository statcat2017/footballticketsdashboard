import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";
import { setupDatabase } from "../../lib/db/setup.ts";
import { createSqliteAppDatabase } from "../../lib/db/adapter.ts";
import { addBatchRows, createBatch, createSource } from "../../lib/import/index.ts";
import { seedE2eFixtures } from "./seed.ts";

const DIR_PREFIX = "nearmefc-e2e-";
const DB_NAME = "nearmefc-e2e.sqlite";

async function globalSetup(): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), DIR_PREFIX));
  const dbPath = path.join(tmpDir, DB_NAME);
  const db = await setupDatabase(dbPath);
  seedE2eFixtures(db);

  const appDb = createSqliteAppDatabase(db);
  const source = await createSource(appDb, {
    sourceType: "csv_paste",
    name: "Runtime smoke source"
  });
  const batch = await createBatch(appDb, {
    sourceId: source.id,
    adapterType: "csv_paste",
    seasonLabel: "2025-26",
    actor: "runtime-smoke"
  });
  await addBatchRows(appDb, batch.id, [
    {
      rowIndex: 0,
      row: {
        homeParticipantRaw: "Chelsea",
        awayParticipantRaw: "Arsenal",
        competitionRaw: "Premier League",
        venueRaw: "Stamford Bridge",
        kickoffDate: "2026-11-01",
        kickoffTime: "15:00"
      }
    }
  ]);

  db.close();
  process.env.SQLITE_DB_PATH = dbPath;
  process.env.E2E_DB_DIR = tmpDir;
  process.env.E2E_IMPORT_BATCH_ID = String(batch.id);

  if (process.env.E2E_STANDALONE === "1") {
    const server = spawn(process.execPath, [".next/standalone/server.js"], {
      env: {
        ...process.env,
        ADMIN_SECRET: "playwright-runtime-smoke-admin",
        ADMIN_SESSION_SECRET: "playwright-runtime-smoke-session",
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        PORT: "3000",
        SQLITE_DB_PATH: dbPath
      },
      stdio: "inherit"
    });

    if (!server.pid) throw new Error("Could not start the standalone server for E2E smoke.");
    process.env.E2E_STANDALONE_PID = String(server.pid);

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) {
        throw new Error(`Standalone server exited before readiness with code ${server.exitCode}.`);
      }
      try {
        const response = await fetch("http://127.0.0.1:3000/api/health");
        if (response.ok) return;
      } catch {
        // The standalone listener is not ready yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    server.kill("SIGTERM");
    throw new Error("Standalone server did not become healthy within 30 seconds.");
  }
}

export default globalSetup;
