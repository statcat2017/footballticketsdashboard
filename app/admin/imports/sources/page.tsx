import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { getDatabase } from "@/lib/db/client";
import { getSources } from "@/lib/admin/imports";

export const dynamic = "force-dynamic";

export default async function AdminSourcesPage() {
  await requireAdminPageSession();

  const db = await getDatabase();
  const sources = await getSources(db);

  return (
    <main style={{ maxWidth: "64rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{
        padding: "1.25rem 0",
        borderBottom: "1px solid #dce3e2",
        marginBottom: "1.5rem",
      }}>
        <Link href="/admin/imports" style={{
          color: "#6f7e7a", fontSize: "13px", textDecoration: "none", fontWeight: 600
        }}>&larr; Import batches</Link>
        <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>Fixture Sources</h1>
      </header>

      {sources.length === 0 ? (
        <div style={{
          border: "1px solid #b8d9cf", borderRadius: "8px",
          background: "#e8f4f1", padding: "2rem 1rem", textAlign: "center",
          color: "#0e5737", fontSize: "14px"
        }}>
          No sources yet. Sources are created automatically when you import fixtures.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #dce3e2", textAlign: "left" }}>
              <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#6f7e7a", fontSize: "12px", textTransform: "uppercase" }}>ID</th>
              <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#6f7e7a", fontSize: "12px", textTransform: "uppercase" }}>Name</th>
              <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#6f7e7a", fontSize: "12px", textTransform: "uppercase" }}>Type</th>
              <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#6f7e7a", fontSize: "12px", textTransform: "uppercase" }}>Trust</th>
              <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#6f7e7a", fontSize: "12px", textTransform: "uppercase" }}>Base URL</th>
              <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#6f7e7a", fontSize: "12px", textTransform: "uppercase" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #eef1f1" }}>
                <td style={{ padding: "0.5rem 0.75rem", color: "#6f7e7a" }}>{s.id}</td>
                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#17221f" }}>{s.name}</td>
                <td style={{ padding: "0.5rem 0.75rem" }}>
                  <span style={{
                    padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "11px",
                    fontWeight: 600, background: "#f0faf6", color: "#0e5737"
                  }}>
                    {s.sourceType}
                  </span>
                </td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#6f7e7a" }}>{s.trustLevel}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#6f7e7a", fontSize: "13px", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.baseUrl ?? "—"}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#6f7e7a", fontSize: "13px" }}>
                  {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
