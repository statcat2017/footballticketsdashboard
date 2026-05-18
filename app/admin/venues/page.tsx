import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getAdminVenueList } from "@/lib/admin/venues";

export const dynamic = "force-dynamic";

const precisionColors: Record<string, { bg: string; fg: string; border: string }> = {
  exact: { bg: "#0e573718", fg: "#0e5737", border: "#0e573740" },
  postcode: { bg: "#1a6b9c18", fg: "#1a6b9c", border: "#1a6b9c40" },
  ground_approximate: { bg: "#0e573718", fg: "#0e5737", border: "#0e573740" },
  unknown: { bg: "#6f7e7a18", fg: "#6f7e7a", border: "#6f7e7a40" },
};

function precisionLabel(value: string | null): string {
  if (!value) return "Unknown";
  if (value === "ground_approximate") return "Ground located";
  return value.charAt(0).toUpperCase() + value.slice(1).replace("_", " ");
}

export default async function AdminVenuesPage(props: { searchParams: Promise<{ approximate?: string }> }) {
  await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();
  const { approximate } = await props.searchParams;
  const approximateOnly = approximate === "1";

  const venues = await getAdminVenueList({ approximateOnly });
  const allVenues = approximateOnly ? await getAdminVenueList() : venues;

  return (
    <main style={{ maxWidth: "64rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1.25rem 0",
        borderBottom: "1px solid #dce3e2",
        marginBottom: "1.5rem"
      }}>
        <div>
          <Link href="/admin" style={{
            color: "#6f7e7a",
            fontSize: "13px",
            textDecoration: "none",
            fontWeight: 600
          }}>&larr; Dashboard</Link>
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>
            {approximateOnly ? "Approximate Venues" : "Venues"}
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6f7e7a", fontSize: "14px" }}>
            {approximateOnly
              ? `${venues.length} approximate of ${allVenues.length} total`
              : `${venues.length} venue${venues.length !== 1 ? "s" : ""}`
            }
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link href={approximateOnly ? "/admin/venues" : "/admin/venues?approximate=1"} style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            border: "1px solid #dce3e2",
            borderRadius: "7px",
            background: approximateOnly ? "#147a4d" : "#fff",
            color: approximateOnly ? "#fff" : "#34413e",
            padding: "0.4rem 0.8rem",
            fontSize: "13px",
            fontWeight: 700,
            textDecoration: "none"
          }}>
            {approximateOnly ? "All venues" : "Approximate only"}
          </Link>
          <Link href="/admin/venues/new" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            border: "1px solid #147a4d",
            borderRadius: "7px",
            background: "#147a4d",
            color: "#fff",
            padding: "0.5rem 1rem",
            fontSize: "14px",
            fontWeight: 700,
            textDecoration: "none"
          }}>
            + Add Venue
          </Link>
          <form method="post" action="/api/admin/logout">
            <input type="hidden" name="csrf" value={csrfToken} />
            <button type="submit" style={{
              border: "1px solid #dce3e2",
              borderRadius: "7px",
              background: "#fff",
              padding: "0.4rem 0.8rem",
              fontSize: "13px",
              cursor: "pointer"
            }}>Log out</button>
          </form>
        </div>
      </header>

      {venues.length === 0 ? (
        <p style={{ color: "#6f7e7a" }}>{approximateOnly ? "No approximate venues found." : "No venues found."}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#fbfcfc", borderBottom: "1px solid #dce3e2" }}>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Venue</th>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Postcode</th>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Precision</th>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Current Clubs</th>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Coords</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((venue) => {
                const colors = precisionColors[venue.coordinate_precision ?? "unknown"] ?? precisionColors.unknown;
                return (
                  <tr key={venue.id} style={{ borderBottom: "1px solid #eef1f1" }}>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      <Link href={`/admin/venues/${venue.id}`} style={{
                        color: "#17221f",
                        textDecoration: "none",
                        fontWeight: 700
                      }}>
                        {venue.name}
                      </Link>
                    </td>
                    <td style={{ padding: "0.6rem 1rem", color: "#34413e" }}>{venue.postcode}</td>
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
                        {precisionLabel(venue.coordinate_precision)}
                      </span>
                      {venue.is_approximate === 1 && (
                        <span style={{ marginLeft: "0.3rem", fontSize: "11px", color: "#a76800", fontWeight: 600 }}>
                          Approx
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      {venue.current_club_count > 0 ? (
                        <span style={{ fontWeight: 600, color: "#0e5737" }}>{venue.current_club_count}</span>
                      ) : (
                        <span style={{ color: "#6f7e7a" }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: "0.6rem 1rem", color: "#6f7e7a", fontSize: "13px" }}>
                      {venue.latitude.toFixed(4)}, {venue.longitude.toFixed(4)}
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
