import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getAdminVenueList } from "@/lib/admin/venues";

export const dynamic = "force-dynamic";

export default async function AdminVenuesPage() {
  await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();
  const venues = await getAdminVenueList();

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
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>Venues</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6f7e7a", fontSize: "14px" }}>
            {venues.length} venue{venues.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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
        <p style={{ color: "#6f7e7a" }}>No venues found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#fbfcfc", borderBottom: "1px solid #dce3e2" }}>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Venue</th>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Postcode</th>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Current Clubs</th>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Coords</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((venue) => (
                <tr key={venue.id} style={{ borderBottom: "1px solid #eef1f1" }}>
                  <td style={{ padding: "0.6rem 1rem" }}>
                    <Link href={`/admin/venues/${venue.id}`} style={{
                      color: "#17221f",
                      textDecoration: "none",
                      fontWeight: 700
                    }}>
                      {venue.name}
                    </Link>
                    {venue.is_approximate === 1 && (
                      <span style={{ marginLeft: "0.5rem", fontSize: "11px", color: "#a76800", fontWeight: 600 }}>
                        Approx
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "0.6rem 1rem", color: "#34413e" }}>{venue.postcode}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
