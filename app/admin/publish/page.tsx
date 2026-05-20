import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { getAllCompetitionsWithClubs } from "@/lib/admin/clubs";

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

function StatPill({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  const color = warn ? "#a53a2d" : "#6f7e7a";
  const bg = warn ? "#fde9e5" : "#eef1f1";
  return (
    <span style={{
      display: "inline-flex",
      padding: "2px 8px",
      borderRadius: "999px",
      fontSize: "11px",
      fontWeight: 600,
      background: bg,
      color,
      lineHeight: 1.4
    }}>
      {label}: {value}
    </span>
  );
}

export default async function AdminPublishPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();

  const sp = await props.searchParams;
  const successMessage = typeof sp?.success === "string" ? sp.success : null;
  const errorMessage = typeof sp?.error === "string" ? sp.error : null;
  const expandedCompId = typeof sp?.competition_id === "string" && /^\d+$/.test(sp.competition_id)
    ? Number(sp.competition_id)
    : null;

  const db = await getDatabase();
  const data = await getAllCompetitionsWithClubs(db);

  const totalClubs = data.tiers.reduce(
    (sum, t) => sum + t.competitions.reduce((s, c) => s + c.totalClubs, 0),
    0
  ) + data.unassignedClubs.length;
  const totalCompetitions = data.tiers.reduce((sum, t) => sum + t.competitions.length, 0);

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
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>Clubs & Divisions</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6f7e7a", fontSize: "14px" }}>
            Season {data.seasonLabel} &middot; {totalCompetitions} competitions &middot; {totalClubs} clubs
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

      {data.tiers.length === 0 && data.unassignedClubs.length === 0 ? (
        <p style={{ color: "#6f7e7a" }}>No pyramid data found for the latest season.</p>
      ) : (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {data.tiers.map((tier) => (
            <div key={tier.tier} style={{ display: "grid", gap: "1rem" }}>
              <h2 style={{
                margin: 0,
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#17221f",
                paddingBottom: "0.25rem",
                borderBottom: "2px solid #dce3e2"
              }}>
                Tier {tier.tier}
              </h2>
              {tier.competitions.map((comp) => {
                const isExpanded = expandedCompId !== null && expandedCompId === comp.id;

                return (
                  <details key={comp.code ?? comp.name} open={isExpanded} style={{
                    border: "1px solid #dce3e2",
                    borderRadius: "8px",
                    overflow: "hidden"
                  }}>
                    <summary style={{
                      padding: "0.75rem 1rem",
                      background: isExpanded ? "#eef8f1" : "#f5f7f7",
                      cursor: "pointer",
                      listStyle: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.5rem"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "14px", color: "#6f7e7a" }}>
                          {isExpanded ? "\u25BC" : "\u25B6"}
                        </span>
                        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                          {comp.name}
                        </h3>
                        <span style={{
                          fontSize: "12px",
                          color: "#6f7e7a",
                          fontWeight: 600
                        }}>
                          Level {comp.level}
                        </span>
                        <StatPill label="clubs" value={comp.totalClubs} />
                        {comp.missingVenueCount > 0 && (
                          <StatPill label="no venue" value={comp.missingVenueCount} warn />
                        )}
                        {comp.missingTicketUrlCount > 0 && (
                          <StatPill label="no ticket URL" value={comp.missingTicketUrlCount} warn />
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <StatusBadge published={comp.isPublished} />
                        {!comp.isPublished && comp.id !== null && (
                          <form method="post" action="/api/admin/publish/competition">
                            <input type="hidden" name="csrf" value={csrfToken} />
                            <input type="hidden" name="division_id" value={comp.id} />
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
                      </div>
                    </summary>

                    <div style={{ overflowX: "auto" }}>
                      {comp.isPublished && comp.id !== null && (
                        <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #eef1f1" }}>
                          <form method="post" action="/api/admin/publish/clubs" style={{ display: "inline" }}>
                            <input type="hidden" name="csrf" value={csrfToken} />
                            <input type="hidden" name="division_id" value={comp.id} />
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
                              Publish all ready clubs
                            </button>
                          </form>
                        </div>
                      )}
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                        <thead>
                          <tr style={{ background: "#fbfcfc", borderBottom: "1px solid #dce3e2" }}>
                            <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Club</th>
                            <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Status</th>
                            <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Venue</th>
                            <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Ticket URL</th>
                            <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {comp.clubs.map((club) => (
                            <tr key={club.id} style={{ borderBottom: "1px solid #eef1f1" }}>
                              <td style={{ padding: "0.6rem 1rem" }}>
                                <Link href={`/admin/clubs/${club.id}`} style={{
                                  color: "#17221f",
                                  textDecoration: "none",
                                  fontWeight: 700,
                                  fontSize: "14px"
                                }}>
                                  {club.name}
                                </Link>
                              </td>
                              <td style={{ padding: "0.6rem 1rem" }}>
                                <StatusBadge published={club.isPublished} />
                              </td>
                              <td style={{ padding: "0.6rem 1rem", color: club.venueName ? "#34413e" : "#a53a2d" }}>
                                {club.venueName ?? (
                                  <span style={{ fontSize: "12px", fontWeight: 600 }}>No venue</span>
                                )}
                              </td>
                              <td style={{ padding: "0.6rem 1rem", color: club.hasTicketUrl ? "#34413e" : "#a53a2d" }}>
                                {club.hasTicketUrl ? (
                                  <span style={{ fontSize: "12px" }}>Set</span>
                                ) : (
                                  <span style={{ fontSize: "12px", fontWeight: 600 }}>Missing</span>
                                )}
                              </td>
                              <td style={{ padding: "0.6rem 1rem" }}>
                                {!club.isPublished && club.venueName && comp.isPublished && comp.id !== null && (
                                  <form method="post" action="/api/admin/publish/club">
                                    <input type="hidden" name="csrf" value={csrfToken} />
                                    <input type="hidden" name="club_id" value={club.id} />
                                    <input type="hidden" name="redirect_division_id" value={comp.id} />
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
                                  <span style={{ fontSize: "12px", color: "#a53a2d", fontWeight: 600 }}>
                                    Create venue first
                                  </span>
                                )}
                                {!club.isPublished && club.venueName && !comp.isPublished && (
                                  <span style={{ fontSize: "12px", color: "#a53a2d", fontWeight: 600 }}>
                                    Publish competition first
                                  </span>
                                )}
                                {club.isPublished && (
                                  <span style={{ fontSize: "12px", color: "#6f7e7a" }}>&mdash;</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </div>
          ))}

          {data.unassignedClubs.length > 0 && (
            <section style={{
              border: "1px solid #dce3e2",
              borderRadius: "8px",
              overflow: "hidden"
            }}>
              <div style={{
                padding: "0.75rem 1rem",
                background: "#fff4d6",
                borderBottom: "1px solid #dce3e2"
              }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#8a5a00" }}>
                  Unassigned clubs
                </h2>
                <span style={{
                  fontSize: "12px",
                  color: "#6f7e7a",
                  fontWeight: 600
                }}>
                  {data.unassignedClubs.length} clubs
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ background: "#fbfcfc", borderBottom: "1px solid #dce3e2" }}>
                      <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Club</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Status</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Ground</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.unassignedClubs.map((club) => (
                      <tr key={club.id} style={{ borderBottom: "1px solid #eef1f1" }}>
                        <td style={{ padding: "0.6rem 1rem" }}>
                          <Link href={`/admin/clubs/${club.id}`} style={{
                            color: "#17221f", textDecoration: "none", fontWeight: 700, fontSize: "14px"
                          }}>
                            {club.name}
                          </Link>
                        </td>
                        <td style={{ padding: "0.6rem 1rem" }}>
                          <span style={{
                            display: "inline-flex",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 750,
                            background: club.status === "known" ? "#eef8f1" : club.status === "partial" ? "#fff4d6" : "#fde9e5",
                            color: club.status === "known" ? "#0e5737" : club.status === "partial" ? "#a76800" : "#a53a2d",
                            border: "1px solid transparent",
                            lineHeight: 1.4
                          }}>
                            {club.status}
                          </span>
                        </td>
                        <td style={{ padding: "0.6rem 1rem", color: club.venueName ? "#34413e" : "#a53a2d" }}>
                          {club.venueName ?? (
                            <span style={{ fontSize: "12px", fontWeight: 600 }}>No primary ground</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
