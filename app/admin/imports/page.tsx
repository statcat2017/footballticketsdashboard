import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { getRecentBatches } from "@/lib/admin/imports";
import { getDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function AdminImportsPage() {
  await requireAdminPageSession();

  const db = await getDatabase();
  const batches = await getRecentBatches(db);

  return (
    <main style={{ maxWidth: "64rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{
        padding: "1.25rem 0",
        borderBottom: "1px solid #dce3e2",
        marginBottom: "1.5rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <Link href="/admin" style={{
            color: "#6f7e7a", fontSize: "13px", textDecoration: "none", fontWeight: 600
          }}>&larr; Dashboard</Link>
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>Fixture Imports</h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link href="/admin/imports/new" style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            border: "1px solid #147a4d", borderRadius: "7px",
            background: "#147a4d", color: "#fff",
            padding: "0.5rem 1rem", fontSize: "14px", fontWeight: 700, textDecoration: "none"
          }}>
            New import &rarr;
          </Link>
          <Link href="/admin/imports/sources" style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            border: "1px solid #6f7e7a", borderRadius: "7px",
            background: "#fff", color: "#6f7e7a",
            padding: "0.5rem 1rem", fontSize: "14px", fontWeight: 600, textDecoration: "none"
          }}>
            Sources
          </Link>
        </div>
      </header>

      {batches.length === 0 ? (
        <div style={{
          border: "1px solid #b8d9cf", borderRadius: "8px",
          background: "#e8f4f1", padding: "2rem 1rem", textAlign: "center",
          color: "#0e5737", fontSize: "14px"
        }}>
          No imports yet. <Link href="/admin/imports/new" style={{ color: "#147a4d", fontWeight: 600 }}>Create your first import</Link>.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #dce3e2", textAlign: "left" }}>
              <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#6f7e7a", fontSize: "12px", textTransform: "uppercase" }}>ID</th>
              <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#6f7e7a", fontSize: "12px", textTransform: "uppercase" }}>Source</th>
              <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#6f7e7a", fontSize: "12px", textTransform: "uppercase" }}>Type</th>
              <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#6f7e7a", fontSize: "12px", textTransform: "uppercase" }}>Season</th>
              <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#6f7e7a", fontSize: "12px", textTransform: "uppercase" }}>Rows</th>
              <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#6f7e7a", fontSize: "12px", textTransform: "uppercase" }}>Status</th>
              <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#6f7e7a", fontSize: "12px", textTransform: "uppercase" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} style={{ borderBottom: "1px solid #eef1f1" }}>
                <td style={{ padding: "0.5rem 0.75rem" }}>
                  <Link href={`/admin/imports/${b.id}`} style={{ color: "#147a4d", fontWeight: 600, textDecoration: "none" }}>
                    #{b.id}
                  </Link>
                </td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#17221f" }}>{b.sourceName}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#6f7e7a", fontSize: "13px" }}>{b.adapterType}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#6f7e7a" }}>{b.seasonLabel ?? "—"}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#17221f" }}>{b.rowCountTotal}</td>
                <td style={{ padding: "0.5rem 0.75rem" }}>
                  <StatusBadge status={b.approvalStatus} />
                </td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#6f7e7a", fontSize: "13px" }}>
                  {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    approved: { bg: "#e8f4f1", fg: "#0e5737" },
    partially_approved: { bg: "#fdf3e9", fg: "#8a5a00" },
    preview: { bg: "#e8f4f1", fg: "#0e5737" },
    pending: { bg: "#f5f6f6", fg: "#6f7e7a" },
    failed: { bg: "#fde9e5", fg: "#a53a2d" },
  };
  const s = styles[status] ?? { bg: "#f5f6f6", fg: "#6f7e7a" };
  return (
    <span style={{
      padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "11px",
      fontWeight: 600, background: s.bg, color: s.fg,
    }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
