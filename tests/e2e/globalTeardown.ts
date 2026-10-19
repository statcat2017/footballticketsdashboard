import fs from "node:fs";

async function globalTeardown(): Promise<void> {
  const serverPid = process.env.E2E_STANDALONE_PID;
  if (serverPid) {
    try {
      process.kill(Number(serverPid), "SIGTERM");
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") throw error;
    }
  }

  const dir = process.env.E2E_DB_DIR;
  if (dir) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export default globalTeardown;
