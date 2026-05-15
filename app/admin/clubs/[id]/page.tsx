import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getAdminClubDetail } from "@/lib/admin/clubs";
import { getAdminVenueList, nextJuly1st } from "@/lib/admin/venues";

export const dynamic = "force-dynamic";

const statusOptions = ["known", "partial", "missing"] as const;

export default async function AdminClubDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const { id } = await props.params;
  const { edit, error } = await props.searchParams;
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

  const isEditing = edit === "1";
  const allVenues = await getAdminVenueList();
  const defaultEffectiveFrom = nextJuly1st();

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
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link href={isEditing ? `/admin/clubs/${clubId}` : `/admin/clubs/${clubId}?edit=1`} style={{
            border: "1px solid #dce3e2",
            borderRadius: "7px",
            background: "#fff",
            padding: "0.4rem 0.8rem",
            fontSize: "13px",
            cursor: "pointer",
            textDecoration: "none",
            color: "#34413e",
            fontWeight: 600
          }}>
            {isEditing ? "Cancel" : "Edit"}
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

      {data.warnings.length > 0 && !isEditing && (
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

          {isEditing ? (
            <form method="post" action={`/api/admin/clubs/${clubId}`} style={{ padding: "1rem", display: "grid", gap: "0.75rem", fontSize: "14px" }}>
              <input type="hidden" name="csrf" value={csrfToken} />

              <div style={{ display: "grid", gap: "0.25rem" }}>
                <label htmlFor="name" style={{ fontWeight: 600, color: "#34413e" }}>Name</label>
                <input id="name" name="name" type="text" defaultValue={data.club.name}
                  style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
                />
              </div>

              <div style={{ display: "grid", gap: "0.25rem" }}>
                <label htmlFor="aliases" style={{ fontWeight: 600, color: "#34413e" }}>Aliases</label>
                <input id="aliases" name="aliases" type="text" defaultValue={data.club.aliases ?? ""}
                  style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
                />
              </div>

              <div style={{ display: "grid", gap: "0.25rem" }}>
                <label htmlFor="status" style={{ fontWeight: 600, color: "#34413e" }}>Status</label>
                <select id="status" name="status" defaultValue={data.club.status}
                  style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px", background: "#fff" }}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gap: "0.25rem" }}>
                <label htmlFor="source_url" style={{ fontWeight: 600, color: "#34413e" }}>Source URL</label>
                <input id="source_url" name="source_url" type="url" defaultValue={data.club.source_url ?? ""}
                  style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
                />
              </div>

              <div style={{ display: "grid", gap: "0.25rem" }}>
                <label htmlFor="verified_at" style={{ fontWeight: 600, color: "#34413e" }}>Verified At</label>
                <input id="verified_at" name="verified_at" type="date" defaultValue={data.club.verified_at ?? ""}
                  style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
                />
              </div>

              <div style={{ marginTop: "0.5rem" }}>
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
                  Save Club Details
                </button>
              </div>
            </form>
          ) : (
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
          )}
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
                  <Link href={`/admin/venues/${data.primaryVenue.id}`} style={{ fontWeight: 700, color: "#0e5737", textDecoration: "none" }}>
                    {data.primaryVenue.name} &rarr;
                  </Link>
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
                        <Link href={`/admin/venues/${va.venue_id}`} style={{ color: "#17221f", textDecoration: "none" }}>
                          {va.venue_name}
                        </Link>
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

          <div style={{
            padding: "1rem",
            borderTop: "1px solid #dce3e2",
            background: "#fbfcfc"
          }}>
            <details>
              <summary style={{ cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#147a4d" }}>
                Assign New Primary Ground
              </summary>
              <form method="post" action="/api/admin/assign-venue" style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
                <input type="hidden" name="csrf" value={csrfToken} />
                <input type="hidden" name="club_id" value={clubId} />

                <div style={{ display: "grid", gap: "0.25rem" }}>
                  <label htmlFor="venue_id" style={{ fontSize: "14px", fontWeight: 600, color: "#34413e" }}>Venue</label>
                  <select id="venue_id" name="venue_id" required
                    style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px", background: "#fff" }}
                  >
                    <option value="">Select a venue...</option>
                    {allVenues.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name}, {venue.postcode}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gap: "0.25rem" }}>
                  <label htmlFor="effective_from" style={{ fontSize: "14px", fontWeight: 600, color: "#34413e" }}>
                    Effective From
                  </label>
                  <input id="effective_from" name="effective_from" type="date"
                    defaultValue={defaultEffectiveFrom}
                    style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
                  />
                  {data.primaryVenue && (
                    <span style={{ fontSize: "12px", color: "#6f7e7a", marginTop: "0.15rem" }}>
                      Current assignment will end on the day before the effective date.
                    </span>
                  )}
                </div>

                <button type="submit" style={{
                  justifySelf: "start",
                  border: "1px solid #147a4d",
                  borderRadius: "7px",
                  background: "#147a4d",
                  color: "#fff",
                  padding: "0.5rem 1.25rem",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}>
                  Assign Venue
                </button>
              </form>
            </details>
          </div>
        </section>
      </div>
    </main>
  );
}
