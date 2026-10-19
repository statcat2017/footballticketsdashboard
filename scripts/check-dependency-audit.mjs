import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const knownAdvisory = "GHSA-VFJ7-8CJW-P6XM";
const exceptionExpires = "2026-11-19";

function advisoryIdsFor(name, vulnerabilities, visited = new Set()) {
  if (visited.has(name)) return [];
  visited.add(name);

  const entry = vulnerabilities[name];
  if (!entry) return [];

  const ids = [];
  for (const via of entry.via ?? []) {
    if (typeof via === "string") {
      ids.push(...advisoryIdsFor(via, vulnerabilities, new Set(visited)));
      continue;
    }

    const urlMatch = typeof via?.url === "string"
      ? via.url.match(/GHSA-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/i)
      : null;
    ids.push(urlMatch?.[0]?.toUpperCase() ?? "unidentified-advisory");
  }

  return [...new Set(ids)];
}

export function assertDependencyAudits(fullAudit, productionAudit, now = new Date()) {
  const productionIssues = Object.entries(productionAudit.vulnerabilities ?? {});
  if (productionIssues.length > 0) {
    throw new Error(`Production dependency audit found vulnerabilities: ${productionIssues.map(([name, item]) => `${name} (${item.severity})`).join(", ")}`);
  }

  const vulnerabilities = fullAudit.vulnerabilities ?? {};
  const issueEntries = Object.entries(vulnerabilities);
  if (issueEntries.length === 0) return ["Full and production dependency audits passed with no findings."];

  const expired = now.toISOString().slice(0, 10) > exceptionExpires;
  const bracesAdvisoryPresent = advisoryIdsFor("braces", vulnerabilities).includes(knownAdvisory);
  const unexpectedIssues = issueEntries.filter(([name, item]) => {
    if (item.severity !== "high") return true;
    const ids = advisoryIdsFor(name, vulnerabilities);
    return ids.length === 0 || ids.some((id) => id !== knownAdvisory);
  });

  if (expired || !bracesAdvisoryPresent || unexpectedIssues.length > 0) {
    const unexpected = unexpectedIssues.map(([name, item]) => `${name} (${item.severity})`).join(", ");
    throw new Error([
      expired ? `The ${knownAdvisory} exception expired on ${exceptionExpires}.` : "",
      !bracesAdvisoryPresent ? `The expected ${knownAdvisory} development-only advisory changed or was resolved.` : "",
      unexpected ? `Unapproved dependency findings: ${unexpected}.` : ""
    ].filter(Boolean).join(" "));
  }

  return [
    `Production audit passed (${productionAudit.metadata?.vulnerabilities?.total ?? 0} findings).`,
    `Full audit has ${issueEntries.length} documented development-only findings in the ${knownAdvisory} chain; exception expires ${exceptionExpires}.`
  ];
}

function runAudit(args) {
  const result = spawnSync("npm", ["audit", "--json", ...args], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });

  if (result.error) {
    throw new Error(`Could not run npm audit: ${result.error.message}`);
  }

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`npm audit exited with status ${result.status}: ${result.stderr}`);
  }

  let audit;
  try {
    audit = JSON.parse(result.stdout);
  } catch {
    throw new Error(`npm audit did not return JSON. ${result.stderr || result.stdout}`);
  }

  if (audit.error) {
    throw new Error(`npm audit failed (${audit.error.code ?? "unknown error"}): ${audit.error.summary ?? audit.error.message ?? "registry audit unavailable"}`);
  }

  if (result.status === 1 && Object.keys(audit.vulnerabilities ?? {}).length === 0) {
    throw new Error("npm audit exited with findings status but returned no vulnerability data.");
  }

  return audit;
}

function main() {
  const fullAudit = runAudit([]);
  const productionAudit = runAudit(["--omit=dev"]);
  for (const message of assertDependencyAudits(fullAudit, productionAudit)) console.log(message);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Dependency audit failed.");
    process.exitCode = 1;
  }
}
