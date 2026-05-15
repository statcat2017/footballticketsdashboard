import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getAdminClubList } from "@/lib/admin/clubs";

export const dynamic = "force-dynamic";

function ClubStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    known: { bg: "#eef8f1", color: "#0e5737" },
    partial: { bg: "#fff4d6", color: "#a76800" },
    missing: { bg: "#fde9e5", color: "#a53a2d" }
  };

  const s = colors[status] ?? { bg: "#eef1f1", color: "#34413e" };

  return (
    <span style={{
      display: "inline-flex",
      padding: "2px 8px",
      borderRadius: "999px",
      fontSize: "11px",
      fontWeight: 750,
      background: s.bg,
      color: s.color,
      border: "1px solid transparent",
      lineHeight: 1.4
    }}>
      {status}
    </span>
  );
}

function WarningNote({ text }: { text: string }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize: "12px",
      color: "#a53a2d",
      fontWeight: 600
    }}>
      <span style={{ fontSize: "14px" }}>&#9888;</span>
      {text}
    </span>
  );
}

export default async function AdminClubsPage() {
  await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();
  const data = await getAdminClubList();

  const totalClubs = data.divisions.reduce((sum, d) => sum + d.clubs.length, 0);

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
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>Clubs</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6f7e7a", fontSize: "14px" }}>
            Season {data.season_label} &middot; {data.divisions.length} divisions &middot; {totalClubs} clubs
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
        <p style={{ color: "#6f7e7a" }}>No clubs found for this season.</p>
      ) : (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {data.divisions.map((division) => (
            <section key={division.season_division_id} style={{
              border: "1px solid #dce3e2",
              borderRadius: "8px",
              overflow: "hidden"
            }}>
              <div style={{
                padding: "0.75rem 1rem",
                background: "#f5f7f7",
                borderBottom: "1px solid #dce3e2",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                  {division.division_name}
                </h2>
                <span style={{
                  fontSize: "12px",
                  color: "#6f7e7a",
                  fontWeight: 600
                }}>
                  Level {division.division_level} &middot; {division.clubs.length} clubs
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
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
                      <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Status</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Ground</th>
                    </tr>
                  </thead>
                  <tbody>
                    {division.clubs.map((club) => (
                      <tr key={club.club_id} style={{
                        borderBottom: "1px solid #eef1f1"
                      }}>
                        <td style={{ padding: "0.6rem 1rem" }}>
                          <Link href={`/admin/clubs/${club.club_id}`} style={{
                            color: "#17221f",
                            textDecoration: "none",
                            fontWeight: 700,
                            fontSize: "14px"
                          }}>
                            {club.club_name}
                          </Link>
                        </td>
                        <td style={{ padding: "0.6rem 1rem" }}>
                          <ClubStatusBadge status={club.club_status} />
                        </td>
                        <td style={{ padding: "0.6rem 1rem", color: club.venue_name ? "#34413e" : "#a53a2d" }}>
                          {club.venue_name ? (
                            <span>{club.venue_name}{club.venue_postcode ? `, ${club.venue_postcode}` : ""}</span>
                          ) : (
                            <WarningNote text="No primary ground" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
