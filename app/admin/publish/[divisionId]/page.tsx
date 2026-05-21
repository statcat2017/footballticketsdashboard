import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { getDivisionDetail, getPromoteTargets, getRelegateTargets, getMigrateTargets, getClubsInDivision } from "@/lib/admin/divisionAssignments";
import { ClubAutocomplete } from "@/app/components/admin/ClubAutocomplete";
import { ClubMovementButtons } from "@/app/components/admin/ClubMovementButtons";
import { DivisionGroundsMapWrapper } from "./_components/DivisionGroundsMapWrapper";

export const dynamic = "force-dynamic";

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

  const unassignedRows = await db.all<{ id: number; name: string; venue_name: string | null }>(
    `SELECT c.id, c.name, v.name AS venue_name
    FROM clubs c
    LEFT JOIN division_assignments da ON da.club_id = c.id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE da.id IS NULL
    ORDER BY c.name`
  );

  const promoteTargets = await getPromoteTargets(db, divId);
  const relegateTargets = await getRelegateTargets(db, divId);
  const migrateTargets = await getMigrateTargets(db, divId);

  const allTargetDivisionIds = new Set<number>();
  promoteTargets.forEach((d) => allTargetDivisionIds.add(d.id));
  relegateTargets.forEach((d) => allTargetDivisionIds.add(d.id));
  migrateTargets.forEach((d) => allTargetDivisionIds.add(d.id));

  const allClubsByDivision: Record<number, { id: number; name: string }[]> = {};
  for (const divId of allTargetDivisionIds) {
    allClubsByDivision[divId] = await getClubsInDivision(db, divId);
  }

  const clubCount = detail.clubCount;
  const maxSize = detail.maxSize;
  const remainingSpaces = maxSize - clubCount;
  const groundMarkers = detail.clubs.flatMap((club) => {
    if (
      club.venueName &&
      club.venueLatitude !== null &&
      club.venueLongitude !== null &&
      Number.isFinite(club.venueLatitude) &&
      Number.isFinite(club.venueLongitude)
    ) {
      return [{
        clubId: club.id,
        clubName: club.name,
        venueName: club.venueName,
        postcode: club.venuePostcode,
        lat: club.venueLatitude,
        lng: club.venueLongitude,
      }];
    }

    return [];
  });
  const unplacedClubs = detail.clubs
    .filter((club) =>
      !club.venueName ||
      club.venueLatitude === null ||
      club.venueLongitude === null ||
      !Number.isFinite(club.venueLatitude) ||
      !Number.isFinite(club.venueLongitude)
    )
    .map((club) => ({
      clubId: club.id,
      clubName: club.name,
      venueName: club.venueName,
      postcode: club.venuePostcode,
    }));

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
        {detail.missingVenueCount > 0 && (
          <Metric label="Missing venue" value={detail.missingVenueCount} warn />
        )}
        {detail.missingTicketUrlCount > 0 && (
          <Metric label="No ticket URL" value={detail.missingTicketUrlCount} warn />
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
              }))}
              csrfToken={csrfToken}
              maxCapacity={maxSize}
              clubCount={clubCount}
            />
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
        {clubCount > 0 && (
          <DivisionGroundsMapWrapper markers={groundMarkers} unplacedClubs={unplacedClubs} />
        )}
        {clubCount > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#fbfcfc", borderBottom: "1px solid #dce3e2" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Club</th>
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
                          <ClubMovementButtons
                            clubId={club.id}
                            clubName={club.name}
                            currentDivisionLevel={detail.level}
                            csrfToken={csrfToken}
                            redirectDivisionId={divId}
                            promoteTargets={promoteTargets}
                            relegateTargets={relegateTargets}
                            migrateTargets={migrateTargets}
                            allClubsByDivision={allClubsByDivision}
                          />
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
