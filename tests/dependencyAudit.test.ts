import { describe, expect, it } from "vitest";
import { assertDependencyAudits } from "@/scripts/check-dependency-audit.mjs";

const productionAudit = {
  vulnerabilities: {},
  metadata: { vulnerabilities: { total: 0 } }
};

function auditWithBracesAdvisories(advisories: Array<{ url: string }>) {
  return {
    vulnerabilities: {
      braces: {
        severity: "high",
        via: advisories.map((advisory) => ({
          source: 1234,
          name: "braces",
          title: "Brace expansion vulnerability",
          severity: "high",
          ...advisory
        }))
      }
    }
  };
}

describe("dependency audit exception", () => {
  it("accepts only the documented advisory in the development audit", () => {
    expect(() => assertDependencyAudits(
      auditWithBracesAdvisories([{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" }]),
      productionAudit,
      new Date("2026-10-19T00:00:00.000Z")
    )).not.toThrow();
  });

  it("rejects a second high-severity advisory affecting an otherwise allowlisted package", () => {
    expect(() => assertDependencyAudits(
      auditWithBracesAdvisories([
        { url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" },
        { url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc" }
      ]),
      productionAudit,
      new Date("2026-10-19T00:00:00.000Z")
    )).toThrow("Unapproved dependency findings: braces (high)");
  });
});
