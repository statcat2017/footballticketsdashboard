import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getPublishableDivisions, getPublishableClubs } from "@/lib/admin/clubs";

export const dynamic = "force-dynamic";

function StatusBadge({ published }: { published: boolean }) {
  if (published) {
    return (
      <span style={{
        display: "inline-flex",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 750,
        background: "#eef8f1",
        color: "#0e5737",
        border: "1px solid transparent",
        lineHeight: 1.4
      }}>
        Published
      </span>
    );
  }

  return (
    <span style={{
      display: "inline-flex",
      padding: "2px 8px",
      borderRadius: "999px",
      fontSize: "11px",
      fontWeight: 750,
      background: "#fde9e5",
      color: "#a53a2d",
      border: "1px solid transparent",
      lineHeight: 1.4
    }}>
      Not published
    </span>
  );
}

export default async function AdminPublishPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();

  const sp = await props.searchParams;
  const successMessage = typeof sp?.success === "string" ? sp.success : null;
  const errorMessage = typeof sp?.error === "string" ? sp.error : null;

  const divisions = await getPublishableDivisions();

  const selectedDivisionId = (() => {
    const raw = typeof sp?.division_id === "string" && /^\d+$/.test(sp.division_id)
      ? Number(sp.division_id)
      : undefined;
    if (raw !== undefined && !divisions.some((d) => d.id === raw)) {
      return undefined;
    }
    return raw;
  })();

  const clubs = selectedDivisionId !== undefined
    ? await getPublishableClubs(selectedDivisionId)
    : [];

  return (
    <main style={{ maxWidth: "64rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      {successMessage && (
        <div style={{
          padding: "0.75rem 1rem",
          marginBottom: "1rem",
          borderRadius: "7px",
          background: "#eef8f1",
          color: "#0e5737",
          border: "1px solid #b8dfc5",
          fontSize: "14px",
          fontWeight: 600
        }}>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{
          padding: "0.75rem 1rem",
          marginBottom: "1rem",
          borderRadius: "7px",
          background: "#fde9e5",
          color: "#a53a2d",
          border: "1px solid #f5bcb3",
          fontSize: "14px",
          fontWeight: 600
        }}>
          {errorMessage}
        </div>
      )}
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
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>Publish</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6f7e7a", fontSize: "14px" }}>
            Create public competition and club records from pyramid data
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

      {divisions.length === 0 ? (
        <p style={{ color: "#6f7e7a" }}>No pyramid data found for the latest season.</p>
      ) : (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {divisions.map((division) => {
            const isSelected = division.id === selectedDivisionId;

            return (
              <section key={division.id} style={{
                border: "1px solid #dce3e2",
                borderRadius: "8px",
                overflow: "hidden"
              }}>
                <div style={{
                  padding: "0.75rem 1rem",
                  background: isSelected ? "#eef8f1" : "#f5f7f7",
                  borderBottom: "1px solid #dce3e2",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.5rem"
                }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, display: "inline" }}>
                      {division.name}
                    </h2>
                    <span style={{
                      marginLeft: "0.5rem",
                      fontSize: "12px",
                      color: "#6f7e7a",
                      fontWeight: 600
                    }}>
                      Level {division.level} &middot; {division.clubCount} clubs
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <StatusBadge published={division.isPublished} />
                    {!division.isPublished && (
                      <form method="post" action="/api/admin/publish/competition">
                        <input type="hidden" name="csrf" value={csrfToken} />
                        <input type="hidden" name="division_id" value={division.id} />
                        {selectedDivisionId !== undefined && (
                          <input type="hidden" name="redirect_division_id" value={selectedDivisionId} />
                        )}
                        <button type="submit" style={{
                          border: "1px solid #147a4d",
                          borderRadius: "7px",
                          background: "#147a4d",
                          color: "#fff",
                          padding: "0.4rem 0.8rem",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}>
                          Publish competition
                        </button>
                      </form>
                    )}

                    <Link
                      href={isSelected ? "/admin/publish" : `/admin/publish?division_id=${division.id}`}
                      style={{
                        border: "1px solid #6f7e7a",
                        borderRadius: "7px",
                        background: isSelected ? "#fff" : "#f5f7f7",
                        padding: "0.4rem 0.8rem",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        textDecoration: "none",
                        color: "#17221f"
                      }}
                    >
                      {isSelected ? "&larr; All divisions" : "Manage clubs"}
                    </Link>
                  </div>
                </div>

                {isSelected && (
                  <div style={{ overflowX: "auto" }}>
                    {clubs.length > 0 ? (
                      <table style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "14px"
                      }}>
                        <thead>
                          <tr style={{
                            background: "#fbfcfc",
                            borderBottom: "1px solid #dce3e2"
                          }}>
                            <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Club</th>
                            <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Venue</th>
                            <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Status</th>
                            <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {clubs.map((club) => (
                            <tr key={club.id} style={{
                              borderBottom: "1px solid #eef1f1"
                            }}>
                              <td style={{ padding: "0.6rem 1rem", fontWeight: 700, color: club.isPublished ? "#6f7e7a" : "#17221f" }}>
                                {club.name}
                              </td>
                              <td style={{
                                padding: "0.6rem 1rem",
                                color: club.venueName ? "#34413e" : "#a53a2d"
                              }}>
                                {club.venueName ?? (
                                  <span style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: "12px",
                                    color: "#a53a2d",
                                    fontWeight: 600
                                  }}>
                                    <span style={{ fontSize: "14px" }}>&#9888;</span>
                                    No primary venue
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "0.6rem 1rem" }}>
                                <StatusBadge published={club.isPublished} />
                              </td>
                              <td style={{ padding: "0.6rem 1rem" }}>
                                {!club.isPublished && club.venueName && division.isPublished && (
                                  <form method="post" action="/api/admin/publish/club">
                                    <input type="hidden" name="csrf" value={csrfToken} />
                                    <input type="hidden" name="pyramid_club_id" value={club.id} />
                                    <input type="hidden" name="redirect_division_id" value={division.id} />
                                    <button type="submit" style={{
                                      border: "1px solid #147a4d",
                                      borderRadius: "7px",
                                      background: "#147a4d",
                                      color: "#fff",
                                      padding: "0.3rem 0.7rem",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      cursor: "pointer"
                                    }}>
                                      Publish
                                    </button>
                                  </form>
                                )}
                                {!club.isPublished && !club.venueName && (
                                  <span style={{
                                    fontSize: "12px",
                                    color: "#a53a2d",
                                    fontWeight: 600
                                  }}>
                                    Create venue first
                                  </span>
                                )}
                                {!club.isPublished && club.venueName && !division.isPublished && (
                                  <span style={{
                                    fontSize: "12px",
                                    color: "#a53a2d",
                                    fontWeight: 600
                                  }}>
                                    Publish competition first
                                  </span>
                                )}
                                {club.isPublished && (
                                  <span style={{
                                    fontSize: "12px",
                                    color: "#6f7e7a"
                                  }}>
                                    &mdash;
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ padding: "1rem", color: "#6f7e7a", fontSize: "14px" }}>
                        No clubs found for this division in the latest season.
                      </p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
