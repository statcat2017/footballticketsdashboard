import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getAdminClubDetail } from "@/lib/admin/clubs";

export const dynamic = "force-dynamic";

export default async function AdminClubDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const clubId = Number(id);

  if (!Number.isInteger(clubId) || clubId <= 0) {
    notFound();
  }

  await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();

  const data = await getAdminClubDetail(clubId);

  if (!data) {
    notFound();
  }

  return (
    <main style={{ maxWidth: "56rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "1.25rem 0",
        borderBottom: "1px solid #dce3e2",
        marginBottom: "1.5rem"
      }}>
        <div>
          <Link href="/admin/clubs" style={{
            color: "#6f7e7a",
            fontSize: "13px",
            textDecoration: "none",
            fontWeight: 600
          }}>&larr; Clubs</Link>
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>{data.club.name}</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6f7e7a", fontSize: "14px" }}>
            {data.season.division_name} (Level {data.season.division_level}) &middot; Season {data.season.label}
          </p>
        </div>
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
      </header>

      {data.warnings.length > 0 && (
        <div style={{
          border: "1px solid #f0beb7",
          borderRadius: "8px",
          background: "#fde9e5",
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
          fontSize: "14px",
          color: "#a53a2d"
        }}>
          {data.warnings.map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>&#9888;</span> {w}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gap: "1.5rem" }}>
        <section style={{
          border: "1px solid #dce3e2",
          borderRadius: "8px",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "0.75rem 1rem",
            background: "#f5f7f7",
            borderBottom: "1px solid #dce3e2",
            fontSize: "0.9rem",
            fontWeight: 700
          }}>
            Club Details
          </div>
          <div style={{ padding: "1rem", display: "grid", gap: "0.75rem", fontSize: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "8rem 1fr", gap: "0.5rem" }}>
              <span style={{ color: "#6f7e7a", fontWeight: 600 }}>Name</span>
              <span>{data.club.name}</span>
            </div>
            {data.club.aliases && (
              <div style={{ display: "grid", gridTemplateColumns: "8rem 1fr", gap: "0.5rem" }}>
                <span style={{ color: "#6f7e7a", fontWeight: 600 }}>Aliases</span>
                <span>{data.club.aliases}</span>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "8rem 1fr", gap: "0.5rem" }}>
              <span style={{ color: "#6f7e7a", fontWeight: 600 }}>Status</span>
              <span>{data.club.status}</span>
            </div>
            {data.club.source_url && (
              <div style={{ display: "grid", gridTemplateColumns: "8rem 1fr", gap: "0.5rem" }}>
                <span style={{ color: "#6f7e7a", fontWeight: 600 }}>Source URL</span>
                <a href={data.club.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "#0e5737" }}>
                  {data.club.source_url}
                </a>
              </div>
            )}
            {data.club.verified_at && (
              <div style={{ display: "grid", gridTemplateColumns: "8rem 1fr", gap: "0.5rem" }}>
                <span style={{ color: "#6f7e7a", fontWeight: 600 }}>Verified</span>
                <span>{data.club.verified_at}</span>
              </div>
            )}
          </div>
        </section>

        <section style={{
          border: "1px solid #dce3e2",
          borderRadius: "8px",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "0.75rem 1rem",
            background: "#f5f7f7",
            borderBottom: "1px solid #dce3e2",
            fontSize: "0.9rem",
            fontWeight: 700
          }}>
            Current Primary Ground
          </div>
          <div style={{ padding: "1rem", fontSize: "14px" }}>
            {data.primaryVenue ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "8rem 1fr", gap: "0.5rem" }}>
                  <span style={{ color: "#6f7e7a", fontWeight: 600 }}>Venue</span>
                  <span style={{ fontWeight: 700 }}>{data.primaryVenue.name}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "8rem 1fr", gap: "0.5rem" }}>
                  <span style={{ color: "#6f7e7a", fontWeight: 600 }}>Postcode</span>
                  <span>{data.primaryVenue.postcode}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "8rem 1fr", gap: "0.5rem" }}>
                  <span style={{ color: "#6f7e7a", fontWeight: 600 }}>Coordinates</span>
                  <span>{data.primaryVenue.latitude.toFixed(4)}, {data.primaryVenue.longitude.toFixed(4)}</span>
                </div>
                {data.primaryVenue.is_approximate === 1 && (
                  <div style={{ display: "grid", gridTemplateColumns: "8rem 1fr", gap: "0.5rem" }}>
                    <span></span>
                    <span style={{ color: "#a76800", fontWeight: 600 }}>Approximate coordinates</span>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: "#a53a2d", margin: 0 }}>
                <span>&#9888;</span> No current primary ground assigned.
              </p>
            )}
          </div>
        </section>

        <section style={{
          border: "1px solid #dce3e2",
          borderRadius: "8px",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "0.75rem 1rem",
            background: "#f5f7f7",
            borderBottom: "1px solid #dce3e2",
            fontSize: "0.9rem",
            fontWeight: 700
          }}>
            Venue Assignments ({data.venueAssignments.length})
          </div>
          {data.venueAssignments.length === 0 ? (
            <div style={{ padding: "1rem", color: "#6f7e7a", fontSize: "14px" }}>
              No venue assignments recorded.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#fbfcfc", borderBottom: "1px solid #dce3e2" }}>
                    <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Venue</th>
                    <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Primary</th>
                    <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>From</th>
                    <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>To</th>
                  </tr>
                </thead>
                <tbody>
                  {data.venueAssignments.map((va) => (
                    <tr key={va.assignment_id} style={{ borderBottom: "1px solid #eef1f1" }}>
                      <td style={{ padding: "0.6rem 1rem", fontWeight: 600 }}>
                        {va.venue_name}
                        <span style={{ color: "#6f7e7a", fontWeight: 400 }}>, {va.venue_postcode}</span>
                      </td>
                      <td style={{ padding: "0.6rem 1rem" }}>
                        {va.is_primary === 1 ? (
                          <span style={{ color: "#0e5737", fontWeight: 700 }}>Yes</span>
                        ) : (
                          <span style={{ color: "#6f7e7a" }}>No</span>
                        )}
                      </td>
                      <td style={{ padding: "0.6rem 1rem" }}>{va.effective_from}</td>
                      <td style={{ padding: "0.6rem 1rem" }}>
                        {va.effective_to ?? <span style={{ color: "#0e5737", fontWeight: 600 }}>Current</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
