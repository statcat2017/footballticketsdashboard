import { spawnSync } from "node:child_process";

const knownAdvisory = "GHSA-vfj7-8cjw-p6xm";
const exceptionExpires = "2026-11-19";
const exceptionPackages = new Set([
  "@next/eslint-plugin-next",
  "braces",
  "eslint-config-next",
  "fast-glob",
  "micromatch"
]);

function runAudit(args) {
  const result = spawnSync("npm", ["audit", "--json", ...args], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });

  let audit;
  try {
    audit = JSON.parse(result.stdout);
  } catch {
    throw new Error(`npm audit did not return JSON. ${result.stderr || result.stdout}`);
  }
  return audit;
}

const fullAudit = runAudit([]);
const productionAudit = runAudit(["--omit=dev"]);
const productionIssues = Object.entries(productionAudit.vulnerabilities ?? {});
if (productionIssues.length > 0) {
  throw new Error(`Production dependency audit found vulnerabilities: ${productionIssues.map(([name, item]) => `${name} (${item.severity})`).join(", ")}`);
}

const vulnerabilities = fullAudit.vulnerabilities ?? {};
const issueEntries = Object.entries(vulnerabilities);
if (issueEntries.length === 0) {
  console.log("Full and production dependency audits passed with no findings.");
  process.exit(0);
}

const expired = new Date().toISOString().slice(0, 10) > exceptionExpires;
const bracesIssue = vulnerabilities.braces;
const bracesAdvisoryPresent = bracesIssue?.via?.some(
  (item) => typeof item === "object" && item.url?.includes(knownAdvisory)
);

function belongsToKnownDevChain(name, visited = new Set()) {
  if (name === "braces") return true;
  if (visited.has(name)) return false;

  return (vulnerabilities[name]?.via ?? []).some(
    (item) => typeof item === "string" && belongsToKnownDevChain(item, new Set([...visited, name]))
  );
}

const unexpectedIssues = issueEntries.filter(([name, item]) => {
  if (item.severity !== "high" || !exceptionPackages.has(name)) return true;
  return !belongsToKnownDevChain(name);
});

if (expired || !bracesAdvisoryPresent || unexpectedIssues.length > 0) {
  const unexpected = unexpectedIssues.map(([name, item]) => `${name} (${item.severity})`).join(", ");
  throw new Error([
    expired ? `The ${knownAdvisory} exception expired on ${exceptionExpires}.` : "",
    !bracesAdvisoryPresent ? `The expected ${knownAdvisory} development-only advisory changed or was resolved.` : "",
    unexpected ? `Unapproved dependency findings: ${unexpected}.` : ""
  ].filter(Boolean).join(" "));
}

console.log(`Production audit passed (${productionAudit.metadata?.vulnerabilities?.total ?? 0} findings).`);
console.log(`Full audit has ${issueEntries.length} documented development-only findings in the ${knownAdvisory} chain; exception expires ${exceptionExpires}.`);
