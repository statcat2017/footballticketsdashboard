import fs from "node:fs";

async function globalTeardown(): Promise<void> {
  const dir = process.env.E2E_DB_DIR;
  if (dir) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export default globalTeardown;
