import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { getDivisionDetail } from "@/lib/admin/divisionAssignments";
import { ClubAutocomplete } from "@/app/components/admin/ClubAutocomplete";

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

function FriendlyBadge() {
  return (
    <span style={{
      display: "inline-flex",
      padding: "2px 8px",
      borderRadius: "999px",
      fontSize: "11px",
      fontWeight: 600,
      background: "#fff4d6",
      color: "#a76800",
      border: "1px solid transparent",
      lineHeight: 1.4
    }}>
      Friendly only
    </span>
  );
}

function Metric({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  const color = warn ? "#a53a2d" : "#6f7e7a";
  const bg = warn ? "#fde9e5" : "#eef1f1";
  return (
    <span style={{
      display: "inline-flex",
      padding: "4px 12px",
      borderRadius: "999px",
      fontSize: "13px",
      fontWeight: 600,
      background: bg,
      color,
      lineHeight: 1.4
    }}>
      {label}: {value}
    </span>
  );
}

export default async function DivisionDetailPage(props: {
  params: Promise<{ divisionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { divisionId } = await props.params;
  const divId = Number(divisionId);

  if (!Number.isInteger(divId) || divId <= 0) {
    notFound();
  }

  await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();

  const sp = await props.searchParams;
  const successMessage = typeof sp?.success === "string" ? sp.success : null;
  const errorMessage = typeof sp?.error === "string" ? sp.error : null;
  const warningMessage = typeof sp?.warning === "string" ? sp.warning : null;

  const db = await getDatabase();
  const detail = await getDivisionDetail(db, divId);

  if (!detail) {
    notFound();
  }

  const unassignedRows = await db.all<{ id: number; name: string; venue_name: string | null; status: string }>(
    `WITH
    friendly_clubs AS (
      SELECT c.id AS club_id FROM clubs c
      JOIN competitions comp ON comp.code = c.competition_code AND comp.kind = 'friendly'
      UNION
      SELECT f.home_club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind = 'friendly'
      WHERE f.home_club_id IS NOT NULL
      UNION
      SELECT f.away_club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind = 'friendly'
      WHERE f.away_club_id IS NOT NULL
    ),
    league_clubs AS (
      SELECT f.home_club_id AS club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind != 'friendly'
      WHERE f.home_club_id IS NOT NULL
      UNION
      SELECT f.away_club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind != 'friendly'
      WHERE f.away_club_id IS NOT NULL
    ),
    friendly_only_clubs AS (
      SELECT club_id FROM friendly_clubs
      EXCEPT
      SELECT club_id FROM league_clubs
    )
    SELECT c.id, c.name, v.name AS venue_name, c.status
    FROM clubs c
    LEFT JOIN division_assignments da ON da.club_id = c.id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE da.id IS NULL
      AND c.id NOT IN (SELECT club_id FROM friendly_only_clubs)
    ORDER BY c.name`
  );

  const clubCount = detail.clubCount;
  const maxSize = detail.maxSize;
  const remainingSpaces = maxSize - clubCount;

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
          <Link href="/admin/publish" style={{
            color: "#6f7e7a",
            fontSize: "13px",
            textDecoration: "none",
            fontWeight: 600
          }}>&larr; All divisions</Link>
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>{detail.name}</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6f7e7a", fontSize: "14px" }}>
            Level {detail.level} &middot; Season {detail.seasonLabel}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <StatusBadge published={detail.isPublished} />
          {!detail.isPublished && (
            <form method="post" action="/api/admin/publish/competition">
              <input type="hidden" name="csrf" value={csrfToken} />
              <input type="hidden" name="division_id" value={divId} />
              <input type="hidden" name="redirect_division_id" value={divId} />
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

      <div style={{
        display: "flex",
        gap: "0.75rem",
        flexWrap: "wrap",
        padding: "0.75rem 1rem",
        background: "#f5f7f7",
        border: "1px solid #dce3e2",
        borderRadius: "8px",
        marginBottom: "1.5rem",
        alignItems: "center"
      }}>
        <Metric label="Clubs" value={`${clubCount}/${maxSize}`} warn={clubCount >= maxSize} />
        <Metric label="Published" value={detail.publishedCount} />
        <Metric label="Unpublished" value={clubCount - detail.publishedCount} warn={clubCount - detail.publishedCount > 0} />
        {detail.missingVenueCount > 0 && (
          <Metric label="Missing venue" value={detail.missingVenueCount} warn />
        )}
        {detail.missingTicketUrlCount > 0 && (
          <Metric label="No ticket URL" value={detail.missingTicketUrlCount} warn />
        )}
        {detail.friendlyOnlyCount > 0 && (
          <Metric label="Friendly only" value={detail.friendlyOnlyCount} />
        )}
        {detail.isPublished && detail.competitionCode ? (
          <span style={{
            display: "inline-flex",
            padding: "4px 12px",
            borderRadius: "999px",
            fontSize: "13px",
            fontWeight: 600,
            background: "#eef8f1",
            color: "#0e5737",
            lineHeight: 1.4
          }}>
            Competition: {detail.competitionCode}
          </span>
        ) : (
          <span style={{
            display: "inline-flex",
            padding: "4px 12px",
            borderRadius: "999px",
            fontSize: "13px",
            fontWeight: 600,
            background: "#fff4d6",
            color: "#a76800",
            lineHeight: 1.4
          }}>
            No competition mapping
          </span>
        )}
      </div>

      <div style={{
        border: "1px solid #dce3e2",
        borderRadius: "8px",
        overflow: "hidden"
      }}>
        <div style={{
          padding: "0.75rem 1rem",
          background: "#f5f7f7",
          borderBottom: "1px solid #dce3e2",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem"
        }}>
          <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>
            Clubs ({clubCount}/{maxSize})
          </span>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <ClubAutocomplete
              divisionId={divId}
              unassignedClubs={unassignedRows.map((r) => ({
                id: r.id,
                name: r.name,
                venueName: r.venue_name,
                status: r.status,
              }))}
              csrfToken={csrfToken}
              maxCapacity={maxSize}
              clubCount={clubCount}
            />
            {detail.isPublished && (
              <form method="post" action="/api/admin/publish/clubs" style={{ display: "inline" }}>
                <input type="hidden" name="csrf" value={csrfToken} />
                <input type="hidden" name="division_id" value={divId} />
                <input type="hidden" name="redirect_division_id" value={divId} />
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
        </div>
        {remainingSpaces > 0 && (
          <div style={{
            padding: "0.5rem 1rem",
            borderBottom: "1px solid #eef1f1",
            fontSize: "12px",
            color: "#6f7e7a"
          }}>
            {remainingSpaces} slot{remainingSpaces !== 1 ? "s" : ""} remaining &middot; Use the search box above to assign clubs
          </div>
        )}
        {clubCount > 0 ? (
          <div style={{ overflowX: "auto" }}>
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
                {detail.clubs.map((club) => (
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
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                          <StatusBadge published={club.isPublished} />
                          {club.isFriendlyOnly && <FriendlyBadge />}
                        </div>
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
                          {!club.isPublished && club.venueName && detail.isPublished && !club.isFriendlyOnly && (
                            <form method="post" action="/api/admin/publish/club">
                              <input type="hidden" name="csrf" value={csrfToken} />
                              <input type="hidden" name="club_id" value={club.id} />
                              <input type="hidden" name="redirect_division_id" value={divId} />
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
                          {!club.isPublished && club.venueName && !detail.isPublished && !club.isFriendlyOnly && (
                            <span style={{ fontSize: "12px", color: "#a76800", fontWeight: 600 }}>
                              Unmapped
                            </span>
                          )}
                          {club.isFriendlyOnly && !club.isPublished && (
                            <span style={{ fontSize: "12px", color: "#a76800", fontWeight: 600 }}>
                              Cannot publish friendly-only club
                            </span>
                          )}
                          <form method="post" action="/api/admin/unassign-club" style={{ display: "inline" }}>
                            <input type="hidden" name="csrf" value={csrfToken} />
                            <input type="hidden" name="club_id" value={club.id} />
                            <input type="hidden" name="redirect_division_id" value={divId} />
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
          </div>
        ) : (
          <p style={{ padding: "1rem", color: "#6f7e7a", fontSize: "14px" }}>
            No clubs assigned to this division.
          </p>
        )}
      </div>
    </main>
  );
}
