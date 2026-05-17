import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { runDataQualityChecks, type DataQualitySeverity } from "@/lib/admin/dataQuality";

export const dynamic = "force-dynamic";

const severityColors: Record<DataQualitySeverity, { bg: string; fg: string; border: string; label: string }> = {
  error: { bg: "#fde9e5", fg: "#a53a2d", border: "#f0beb7", label: "Error" },
  warning: { bg: "#fdf3e9", fg: "#8a5a00", border: "#f0d5b7", label: "Warning" },
  info: { bg: "#e8f4f1", fg: "#0e5737", border: "#b8d9cf", label: "Info" },
};

export default async function AdminDataQualityPage() {
  await requireAdminPageSession();

  const issues = await runDataQualityChecks();

  const counts: Record<DataQualitySeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) {
    counts[issue.severity]++;
  }

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
          const colors = severityColors[sev];
          return (
            <div key={sev} style={{
              flex: 1,
              border: `1px solid ${colors.border}`,
              borderRadius: "8px",
              background: colors.bg,
              padding: "0.75rem 1rem",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: colors.fg }}>{counts[sev]}</div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: colors.fg, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {colors.label}{counts[sev] !== 1 ? "s" : ""}
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
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#fbfcfc", borderBottom: "1px solid #dce3e2" }}>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a", width: "80px" }}>Severity</th>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a", width: "100px" }}>Category</th>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Issue</th>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a", width: "120px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => {
                const colors = severityColors[issue.severity];
                return (
                  <tr key={issue.id} style={{ borderBottom: "1px solid #eef1f1" }}>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      <span style={{
                        padding: "0.1rem 0.4rem",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background: colors.bg,
                        color: colors.fg,
                        border: `1px solid ${colors.border}`
                      }}>
                        {colors.label}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem 1rem", color: "#34413e", fontWeight: 600, fontSize: "13px" }}>
                      {issue.category}
                    </td>
                    <td style={{ padding: "0.6rem 1rem", color: "#17221f" }}>
                      <div style={{ fontWeight: 600 }}>{issue.entity}</div>
                      <div style={{ fontSize: "13px", color: "#6f7e7a", marginTop: "0.1rem" }}>{issue.summary}</div>
                    </td>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      {issue.actionUrl ? (
                        <Link href={issue.actionUrl} style={{
                          color: "#147a4d",
                          fontWeight: 600,
                          fontSize: "13px",
                          textDecoration: "none"
                        }}>
                          View &rarr;
                        </Link>
                      ) : (
                        <span style={{ color: "#6f7e7a", fontSize: "13px" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
