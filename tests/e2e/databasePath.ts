import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const worktreeKey = createHash("sha1").update(process.cwd()).digest("hex").slice(0, 10);

export const e2eDatabasePath = path.join(os.tmpdir(), `nearmefc-e2e-${worktreeKey}.sqlite`);

export function removeE2eDatabaseFiles(): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    const filename = `${e2eDatabasePath}${suffix}`;
    fs.rmSync(filename, { force: true });
  }
}
