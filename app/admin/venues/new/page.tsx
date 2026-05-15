import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { MapEditorWrapper } from "../_components/MapEditorWrapper";

export const dynamic = "force-dynamic";

export default async function AdminNewVenuePage(props: { searchParams: Promise<{ error?: string }> }) {
  await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();
  const { error } = await props.searchParams;

  return (
    <main style={{ maxWidth: "40rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{
        padding: "1.25rem 0",
        borderBottom: "1px solid #dce3e2",
        marginBottom: "1.5rem"
      }}>
        <Link href="/admin/venues" style={{
          color: "#6f7e7a",
          fontSize: "13px",
          textDecoration: "none",
          fontWeight: 600
        }}>&larr; Venues</Link>
        <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>Add Venue</h1>
      </header>

      {error && (
        <div style={{
          border: "1px solid #f0beb7",
          borderRadius: "8px",
          background: "#fde9e5",
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
          fontSize: "14px",
          color: "#a53a2d"
        }}>
          {error}
        </div>
      )}

      <MapEditorWrapper
        isApproximate={false}
        latInputId="latitude"
        lngInputId="longitude"
        approxInputId="is_approximate"
        mode="create"
      />

      <form method="post" action="/api/admin/venues" style={{ display: "grid", gap: "1rem" }}>
        <input type="hidden" name="csrf" value={csrfToken} />

        <div style={{ display: "grid", gap: "0.25rem" }}>
          <label htmlFor="name" style={{ fontSize: "14px", fontWeight: 700, color: "#34413e" }}>Venue Name</label>
          <input id="name" name="name" type="text" required
            style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
          />
        </div>

        <div style={{ display: "grid", gap: "0.25rem" }}>
          <label htmlFor="postcode" style={{ fontSize: "14px", fontWeight: 700, color: "#34413e" }}>Postcode</label>
          <input id="postcode" name="postcode" type="text" required
            style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div style={{ display: "grid", gap: "0.25rem" }}>
            <label htmlFor="latitude" style={{ fontSize: "14px", fontWeight: 700, color: "#34413e" }}>Latitude</label>
            <input id="latitude" name="latitude" type="number" step="any" required
              style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
            />
          </div>
          <div style={{ display: "grid", gap: "0.25rem" }}>
            <label htmlFor="longitude" style={{ fontSize: "14px", fontWeight: 700, color: "#34413e" }}>Longitude</label>
            <input id="longitude" name="longitude" type="number" step="any" required
              style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input id="is_approximate" name="is_approximate" type="checkbox" value="1" />
          <label htmlFor="is_approximate" style={{ fontSize: "14px", color: "#34413e" }}>
            Coordinates are approximate
          </label>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <button type="submit" style={{
            border: "1px solid #147a4d",
            borderRadius: "7px",
            background: "#147a4d",
            color: "#fff",
            padding: "0.5rem 1.25rem",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer"
          }}>
            Save Venue
          </button>
          <Link href="/admin/venues" style={{
            display: "inline-flex",
            alignItems: "center",
            border: "1px solid #dce3e2",
            borderRadius: "7px",
            background: "#fff",
            padding: "0.5rem 1rem",
            fontSize: "14px",
            color: "#34413e",
            textDecoration: "none",
            fontWeight: 600
          }}>
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
