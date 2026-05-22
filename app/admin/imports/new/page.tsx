import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { getSeasons, getSources } from "@/lib/admin/imports";
import UrlImportForm from "./UrlImportForm";

export const dynamic = "force-dynamic";

export default async function AdminNewImportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();
  const sp = await searchParams;

  const db = await getDatabase();
  const seasons = await getSeasons(db);
  const sources = await getSources(db);

  const error = sp.error;
  const mode = sp.mode ?? "csv";

  return (
    <main style={{ maxWidth: "48rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{
        padding: "1.25rem 0",
        borderBottom: "1px solid #dce3e2",
        marginBottom: "1.5rem",
      }}>
        <Link href="/admin/imports" style={{
          color: "#6f7e7a", fontSize: "13px", textDecoration: "none", fontWeight: 600
        }}>&larr; Import batches</Link>
        <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>New Import</h1>
      </header>

      {error && (
        <div style={{
          border: "1px solid #f0beb7", borderRadius: "8px",
          background: "#fde9e5", padding: "0.75rem 1rem",
          marginBottom: "1rem", color: "#a53a2d", fontSize: "14px"
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <Link href="/admin/imports/new?mode=csv" style={{
          padding: "0.5rem 1rem", borderRadius: "7px", fontSize: "14px", fontWeight: 600,
          textDecoration: "none",
          background: mode === "csv" ? "#147a4d" : "#fff",
          color: mode === "csv" ? "#fff" : "#147a4d",
          border: mode === "csv" ? "1px solid #147a4d" : "1px solid #147a4d",
        }}>CSV Paste</Link>
        <Link href="/admin/imports/new?mode=url" style={{
          padding: "0.5rem 1rem", borderRadius: "7px", fontSize: "14px", fontWeight: 600,
          textDecoration: "none",
          background: mode === "url" ? "#147a4d" : "#fff",
          color: mode === "url" ? "#fff" : "#147a4d",
          border: mode === "url" ? "1px solid #147a4d" : "1px solid #147a4d",
        }}>URL Import</Link>
      </div>

      {mode === "csv" ? (
        <form method="post" action="/api/admin/imports/preview-csv" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input type="hidden" name="csrf" value={csrfToken} />

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "14px", marginBottom: "0.25rem", color: "#17221f" }}>
              Source name
            </label>
            <input type="text" name="source_name" list="source-list" placeholder="Manual CSV Paste"
              style={{ width: "100%", padding: "0.5rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }} />
            <datalist id="source-list">
              {sources.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "14px", marginBottom: "0.25rem", color: "#17221f" }}>
              Season
            </label>
            <select name="season_label" defaultValue={seasons.find((s) => s.isCurrent)?.label ?? ""} style={{ width: "100%", padding: "0.5rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}>
              <option value="">Auto-detect</option>
              {seasons.map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label} {s.isCurrent ? "(current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "14px", marginBottom: "0.25rem", color: "#17221f" }}>
              CSV data
            </label>
            <textarea name="csv" rows={15}
              placeholder={"Home,Away,Date,Time,Competition,Venue,Price\nChelsea,Arsenal,2026-05-20,15:00,PL,Stamford Bridge,£30"}
              style={{ width: "100%", padding: "0.5rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "13px", fontFamily: "monospace" }} />
          </div>

          <button type="submit" style={{
            alignSelf: "flex-start",
            border: "1px solid #147a4d", borderRadius: "7px",
            background: "#147a4d", color: "#fff",
            padding: "0.6rem 1.5rem", fontSize: "14px", fontWeight: 700, cursor: "pointer"
          }}>
            Preview &rarr;
          </button>
        </form>
      ) : (
        <UrlImportForm csrfToken={csrfToken} seasons={seasons} />
      )}
    </main>
  );
}
