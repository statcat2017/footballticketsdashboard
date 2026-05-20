import React from "react";
import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { getDivisionAssignments } from "@/lib/admin/divisionAssignments";

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

function StatPill({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
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
  const warningMessage = typeof sp?.warning === "string" ? sp.warning : null;
  const selectedDivisionId = typeof sp?.division_id === "string" ? Number(sp.division_id) : null;

  const db = await getDatabase();
  const data = await getDivisionAssignments(db);

  const totalClubs = data.divisions.reduce((s, d) => s + d.clubCount, 0) + data.unassignedClubs.length;

  const tiers = new Map<number, typeof data.divisions>();
  for (const div of data.divisions) {
    const group = tiers.get(div.level) ?? [];
    group.push(div);
    tiers.set(div.level, group);
  }
  const sortedTiers = Array.from(tiers.entries()).sort(([a], [b]) => a - b);

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
      {warningMessage && (
        <div style={{
          padding: "0.75rem 1rem",
          marginBottom: "1rem",
          borderRadius: "7px",
          background: "#fff4d6",
          color: "#8a5700",
          border: "1px solid #f1d17a",
          fontSize: "14px",
          fontWeight: 600
        }}>
          {warningMessage}
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
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>Division Assignments</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6f7e7a", fontSize: "14px" }}>
            Season {data.seasonLabel} &middot; {data.divisions.length} divisions &middot; {totalClubs} clubs
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

      {data.divisions.length === 0 ? (
        <p style={{ color: "#6f7e7a" }}>No pyramid divisions found.</p>
      ) : (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {selectedDivisionId && (
            <Link href="/admin/publish" style={{
              color: "#147a4d",
              fontSize: "13px",
              fontWeight: 700,
              textDecoration: "none"
            }}>&larr; All divisions</Link>
          )}
          {sortedTiers.map(([tier, divisions]) => (
            <div key={tier} style={{ display: "grid", gap: "1rem" }}>
              <h2 style={{
                margin: 0,
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#17221f",
                paddingBottom: "0.25rem",
                borderBottom: "2px solid #dce3e2"
              }}>
                Tier {tier}
              </h2>
              {divisions.map((div) => {
                const isSelected = selectedDivisionId === div.id;
                const atCapacity = div.clubCount >= div.maxSize;
                const missingVenueCount = div.clubs.filter((c) => !c.venueName).length;
                const missingTicketUrlCount = div.clubs.filter((c) => !c.hasTicketUrl).length;

                return (
                  <div key={div.id} style={{
                    border: "1px solid #dce3e2",
                    borderRadius: "8px",
                    overflow: "hidden"
                  }}>
                    <Link href={isSelected ? "/admin/publish" : `/admin/publish?division_id=${div.id}`} style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "block"
                    }}>
                      <div style={{
                        padding: "0.75rem 1rem",
                        background: isSelected ? "#f5f7f7" : "#fff",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.5rem"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                            {div.name}
                          </h3>
                          <span style={{
                            fontSize: "12px",
                            color: "#6f7e7a",
                            fontWeight: 600
                          }}>
                            Level {div.level}
                          </span>
                          <StatPill label="clubs" value={`${div.clubCount}/${div.maxSize}`} />
                          {atCapacity && (
                            <span style={{
                              display: "inline-flex",
                              padding: "2px 8px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 600,
                              background: "#fff4d6",
                              color: "#a76800",
                              lineHeight: 1.4
                            }}>
                              At capacity
                            </span>
                          )}
                          {missingVenueCount > 0 && (
                            <StatPill label="no venue" value={missingVenueCount} warn />
                          )}
                          {missingTicketUrlCount > 0 && (
                            <StatPill label="no ticket URL" value={missingTicketUrlCount} warn />
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <StatusBadge published={div.isPublished} />
                          {!div.isPublished && (
                            <form method="post" action="/api/admin/publish/competition" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                              <input type="hidden" name="csrf" value={csrfToken} />
                              <input type="hidden" name="division_id" value={div.id} />
                              <input type="hidden" name="redirect_division_id" value={div.id} />
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
                      </div>
                    </Link>

                    {isSelected && (
                      <div style={{ overflowX: "auto" }}>
                        <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #eef1f1", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <form method="post" action="/api/admin/assign-club" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                            <input type="hidden" name="csrf" value={csrfToken} />
                            <input type="hidden" name="division_id" value={div.id} />
                            <input type="hidden" name="redirect_division_id" value={div.id} />
                            <select name="club_id" style={{
                              padding: "0.3rem 0.5rem",
                              border: "1px solid #dce3e2",
                              borderRadius: "6px",
                              fontSize: "13px",
                              background: "#fff"
                            }}>
                              <option value="">Assign a club...</option>
                              {data.unassignedClubs.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            <button type="submit" style={{
                              border: "1px solid #147a4d",
                              borderRadius: "7px",
                              background: "#147a4d",
                              color: "#fff",
                              padding: "0.3rem 0.7rem",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: "pointer"
                            }}>Assign</button>
                          </form>
                          {div.isPublished && (
                            <form method="post" action="/api/admin/publish/clubs" style={{ display: "inline" }}>
                              <input type="hidden" name="csrf" value={csrfToken} />
                              <input type="hidden" name="division_id" value={div.id} />
                              <input type="hidden" name="redirect_division_id" value={div.id} />
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
                                Publish all ready clubs
                              </button>
                            </form>
                          )}
                        </div>
                        {div.clubs.length > 0 ? (
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
                              {div.clubs.map((club) => (
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
                                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                                      {!club.isPublished && club.venueName && div.isPublished && (
                                        <form method="post" action="/api/admin/publish/club">
                                          <input type="hidden" name="csrf" value={csrfToken} />
                                          <input type="hidden" name="club_id" value={club.id} />
                                          <input type="hidden" name="redirect_division_id" value={div.id} />
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
                                          No venue
                                        </span>
                                      )}
                                      {!club.isPublished && club.venueName && !div.isPublished && (
                                        <span style={{ fontSize: "12px", color: "#a76800", fontWeight: 600 }}>
                                          Unmapped
                                        </span>
                                      )}
                                      <form method="post" action="/api/admin/move-club" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                                        <input type="hidden" name="csrf" value={csrfToken} />
                                        <input type="hidden" name="club_id" value={club.id} />
                                        <input type="hidden" name="redirect_division_id" value={div.id} />
                                        <select name="division_id" style={{
                                          padding: "0.2rem 0.3rem",
                                          border: "1px solid #dce3e2",
                                          borderRadius: "4px",
                                          fontSize: "11px",
                                          background: "#fff"
                                        }}>
                                          {data.divisions.filter((d) => d.id !== div.id).map((d) => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                          ))}
                                        </select>
                                        <button type="submit" style={{
                                          border: "1px solid #6f7e7a",
                                          borderRadius: "4px",
                                          background: "#fff",
                                          color: "#34413e",
                                          padding: "0.2rem 0.5rem",
                                          fontSize: "11px",
                                          fontWeight: 600,
                                          cursor: "pointer"
                                        }}>Move</button>
                                      </form>
                                      <form method="post" action="/api/admin/unassign-club" style={{ display: "inline" }}>
                                        <input type="hidden" name="csrf" value={csrfToken} />
                                        <input type="hidden" name="club_id" value={club.id} />
                                        <input type="hidden" name="redirect_division_id" value={div.id} />
                                        <button type="submit" style={{
                                          border: "none",
                                          background: "none",
                                          color: "#a53a2d",
                                          cursor: "pointer",
                                          fontSize: "11px",
                                          fontWeight: 600,
                                          padding: 0
                                        }}>Unassign</button>
                                      </form>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p style={{ padding: "1rem", color: "#6f7e7a", fontSize: "14px" }}>
                            No clubs assigned to this division.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {selectedDivisionId && data.unassignedClubs.length > 0 && (
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
                      <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}></th>
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
                        <td style={{ padding: "0.6rem 1rem" }}>
                          <form method="post" action="/api/admin/assign-club" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            <input type="hidden" name="csrf" value={csrfToken} />
                            <input type="hidden" name="club_id" value={club.id} />
                            <select name="division_id" style={{
                              padding: "0.2rem 0.3rem",
                              border: "1px solid #dce3e2",
                              borderRadius: "4px",
                              fontSize: "11px",
                              background: "#fff"
                            }}>
                              {data.divisions.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                            <button type="submit" style={{
                              border: "1px solid #147a4d",
                              borderRadius: "4px",
                              background: "#147a4d",
                              color: "#fff",
                              padding: "0.2rem 0.5rem",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer"
                            }}>Assign</button>
                          </form>
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
