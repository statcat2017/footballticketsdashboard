import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { runDataQualityChecks, type DataQualityIssue, type DataQualitySeverity } from "@/lib/admin/dataQuality";

export const dynamic = "force-dynamic";

const severityStyles: Record<DataQualitySeverity, { bg: string; fg: string; border: string; label: string }> = {
  error: { bg: "#fde9e5", fg: "#a53a2d", border: "#f0beb7", label: "Error" },
  warning: { bg: "#fdf3e9", fg: "#8a5a00", border: "#f0d5b7", label: "Warning" },
  info: { bg: "#e8f4f1", fg: "#0e5737", border: "#b8d9cf", label: "Info" },
};

interface IssueGroup {
  key: string;
  severity: DataQualitySeverity;
  issueType: string;
  issues: DataQualityIssue[];
}

function buildGroups(issues: DataQualityIssue[]): IssueGroup[] {
  const groups: IssueGroup[] = [];
  let current: IssueGroup | null = null;
  for (const issue of issues) {
    const key = `${issue.severity}||${issue.issueType}`;
    if (!current || current.key !== key) {
      current = { key, severity: issue.severity, issueType: issue.issueType, issues: [] };
      groups.push(current);
    }
    current.issues.push(issue);
  }
  return groups;
}

export default async function AdminDataQualityPage() {
  await requireAdminPageSession();

  const issues = await runDataQualityChecks();

  const counts: Record<DataQualitySeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) {
    counts[issue.severity]++;
  }

  const groups = buildGroups(issues);

  return (
    <main style={{ maxWidth: "64rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{
        padding: "1.25rem 0",
        borderBottom: "1px solid #dce3e2",
        marginBottom: "1.5rem"
      }}>
        <Link href="/admin" style={{
          color: "#6f7e7a",
          fontSize: "13px",
          textDecoration: "none",
          fontWeight: 600
        }}>&larr; Dashboard</Link>
        <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>Data Quality</h1>
      </header>

      <div style={{
        display: "flex",
        gap: "0.75rem",
        marginBottom: "1.5rem"
      }}>
        {(["error", "warning", "info"] as DataQualitySeverity[]).map((sev) => {
          const s = severityStyles[sev];
          return (
            <div key={sev} style={{
              flex: 1,
              border: `1px solid ${s.border}`,
              borderRadius: "8px",
              background: s.bg,
              padding: "0.75rem 1rem",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: s.fg }}>{counts[sev]}</div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: s.fg, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {s.label}{counts[sev] !== 1 ? "s" : ""}
              </div>
            </div>
          );
        })}
      </div>

      {issues.length === 0 ? (
        <div style={{
          border: "1px solid #b8d9cf",
          borderRadius: "8px",
          background: "#e8f4f1",
          padding: "2rem 1rem",
          textAlign: "center",
          color: "#0e5737",
          fontSize: "14px"
        }}>
          No data quality issues found.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {groups.map((group) => {
            const s = severityStyles[group.severity];
            const defaultOpen = group.severity === "error";
            return (
              <details key={group.key} open={defaultOpen} style={{
                border: `1px solid ${s.border}`,
                borderRadius: "8px",
                overflow: "hidden"
              }}>
                <summary style={{
                  padding: "0.6rem 1rem",
                  background: s.bg,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "#17221f",
                  userSelect: "none"
                }}>
                  <span style={{
                    padding: "0.1rem 0.4rem",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: s.bg,
                    color: s.fg,
                    border: `1px solid ${s.border}`
                  }}>
                    {s.label}
                  </span>
                  <span>{group.issueType}</span>
                  <span style={{ color: s.fg, fontWeight: 700, marginLeft: "auto", fontSize: "13px" }}>
                    {group.issues.length}
                  </span>
                </summary>
                <div style={{ padding: "0.5rem 0" }}>
                  {group.issues.map((issue) => (
                    <div key={issue.id} style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                      padding: "0.5rem 1rem",
                      borderBottom: "1px solid #eef1f1",
                      fontSize: "14px"
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "#17221f" }}>{issue.entity}</div>
                        <div style={{ fontSize: "13px", color: "#6f7e7a", marginTop: "0.1rem" }}>{issue.summary}</div>
                      </div>
                      <div style={{ flex: "0 0 auto" }}>
                        {issue.actionUrl ? (
                          <Link href={issue.actionUrl} style={{
                            color: "#147a4d",
                            fontWeight: 600,
                            fontSize: "13px",
                            textDecoration: "none",
                            whiteSpace: "nowrap"
                          }}>
                            View &rarr;
                          </Link>
                        ) : (
                          <span style={{ color: "#6f7e7a", fontSize: "13px" }}>&mdash;</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </main>
  );
}