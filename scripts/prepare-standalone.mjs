import fs from "node:fs";
import path from "node:path";

const standaloneDir = path.join(process.cwd(), ".next", "standalone");
const staticDir = path.join(process.cwd(), ".next", "static");
const bundledNextDir = path.join(standaloneDir, ".next");

if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
  throw new Error("Build the Next.js standalone output before preparing it.");
}
if (!fs.existsSync(staticDir)) {
  throw new Error("The Next.js static asset directory is missing.");
}

fs.mkdirSync(bundledNextDir, { recursive: true });
fs.cpSync(staticDir, path.join(bundledNextDir, "static"), { recursive: true, force: true });

const publicDir = path.join(process.cwd(), "public");
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, path.join(standaloneDir, "public"), { recursive: true, force: true });
}

console.log("Standalone static assets are ready.");
