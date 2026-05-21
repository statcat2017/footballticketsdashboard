import React from "react";
import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import {
  getMovementViewData,
  getDivisionsInTierRange,
  getClubsInDivision,
} from "@/lib/admin/movements";

export const dynamic = "force-dynamic";

const TIER_MIN = 10;
const TIER_MAX = 10;
const REDIRECT_TIER = "tier-10";

function StatPill({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  const color = warn ? "#a53a2d" : "#6f7e7a";
  const bg = warn ? "#fde9e5" : "#eef1f1";
  return (
    <span style={{
      display: "inline-flex", padding: "2px 8px", borderRadius: "999px",
      fontSize: "11px", fontWeight: 600, background: bg, color, lineHeight: 1.4
    }}>
      {label}: {value}
    </span>
  );
}

export default async function Tier10Page(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();

  const sp = await props.searchParams;
  const successMessage = typeof sp?.success === "string" ? sp.success : null;
  const errorMessage = typeof sp?.error === "string" ? sp.error : null;
  const warningMessage = typeof sp?.warning === "string" ? sp.warning : null;
  const infoMessage = typeof sp?.info === "string" ? sp.info : null;

  const db = await getDatabase();
  const view = await getMovementViewData(db, TIER_MIN, TIER_MAX);
  const divisions = await getDivisionsInTierRange(db, TIER_MIN, TIER_MAX);

  const clubsByDivision: Record<number, { id: number; name: string }[]> = {};
  for (const div of divisions) {
    clubsByDivision[div.id] = await getClubsInDivision(db, div.id);
  }

  return (
    <main style={{ maxWidth: "64rem", margin: "0 auto", padding: "0 1rem 5rem", fontFamily: "system-ui, sans-serif" }}>
      {successMessage && (
        <div style={{ padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: "7px", background: "#eef8f1", color: "#0e5737", border: "1px solid #b8dfc5", fontSize: "14px", fontWeight: 600 }}>{successMessage}</div>
      )}
      {errorMessage && (
        <div style={{ padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: "7px", background: "#fde9e5", color: "#a53a2d", border: "1px solid #f5bcb3", fontSize: "14px", fontWeight: 600 }}>{errorMessage}</div>
      )}
      {warningMessage && (
        <div style={{ padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: "7px", background: "#fff4d6", color: "#8a5700", border: "1px solid #f1d17a", fontSize: "14px", fontWeight: 600 }}>{warningMessage}</div>
      )}
      {infoMessage && (
        <div style={{ padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: "7px", background: "#eef1f1", color: "#34413e", border: "1px solid #dce3e2", fontSize: "14px", fontWeight: 600 }}>{infoMessage}</div>
      )}

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 0", borderBottom: "1px solid #dce3e2", marginBottom: "1.5rem" }}>
        <div>
          <Link href="/admin/movements" style={{ color: "#6f7e7a", fontSize: "13px", textDecoration: "none", fontWeight: 600 }}>&larr; All tiers</Link>
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>Tier 10: Step 6 Leagues</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6f7e7a", fontSize: "14px" }}>{divisions.length} divisions &middot; {view.totalSlots} slots &middot; {view.totalFilled} filled</p>
        </div>
        <form method="post" action="/api/admin/logout">
          <input type="hidden" name="csrf" value={csrfToken} />
          <button type="submit" style={{ border: "1px solid #dce3e2", borderRadius: "7px", background: "#fff", padding: "0.4rem 0.8rem", fontSize: "13px", cursor: "pointer" }}>Log out</button>
        </form>
      </header>

      <section style={{ border: "1px solid #dce3e2", borderRadius: "8px", padding: "1rem", marginBottom: "1.5rem", background: "#f5f7f7" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Create slots</h2>
        <form method="post" action="/api/admin/movements/slots" style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="redirect_tier" value={REDIRECT_TIER} />

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#6f7e7a", marginBottom: "0.25rem" }}>Source division</label>
            <input name="source_division_id" list="source-divisions" placeholder="Type to search..." style={{ padding: "0.4rem 0.6rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "13px", minWidth: "220px" }} />
            <datalist id="source-divisions">
              {divisions.map((d) => <option key={d.id} value={String(d.id)}>{d.name} (Tier {d.level})</option>)}
            </datalist>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#6f7e7a", marginBottom: "0.25rem" }}>Target division</label>
            <input name="target_division_id" list="target-divisions" placeholder="Type to search..." style={{ padding: "0.4rem 0.6rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "13px", minWidth: "220px" }} />
            <datalist id="target-divisions">
              {divisions.map((d) => <option key={d.id} value={String(d.id)}>{d.name} (Tier {d.level})</option>)}
            </datalist>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#6f7e7a", marginBottom: "0.25rem" }}>Movement</label>
            <select name="movement_type" style={{ padding: "0.4rem 0.6rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "13px" }}>
              <option value="promotion">Promotion</option>
              <option value="relegation">Relegation</option>
              <option value="migration">Migration</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#6f7e7a", marginBottom: "0.25rem" }}>Count</label>
            <input type="number" name="count" min="1" max="50" defaultValue="2" style={{ padding: "0.4rem 0.6rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "13px", width: "60px" }} />
          </div>

          <button type="submit" style={{ border: "none", borderRadius: "7px", background: "#147a4d", color: "#fff", padding: "0.4rem 1rem", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Create</button>
        </form>
      </section>

      {view.slotGroups.length === 0 ? (
        <p style={{ color: "#6f7e7a", fontSize: "14px" }}>No slots created yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {view.slotGroups.map((group, gi) => (
            <div key={gi} style={{ border: "1px solid #dce3e2", borderRadius: "8px", overflow: "hidden" }}>
              <div style={{ padding: "0.75rem 1rem", background: "#f5f7f7", borderBottom: "1px solid #dce3e2", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{group.sourceDivisionName}</span>
                <span style={{ color: "#6f7e7a", fontSize: "13px" }}>
                  {group.movementType === "promotion" ? "\u2191" : group.movementType === "relegation" ? "\u2193" : "\u2194"} {group.targetDivisionName}
                </span>
                <StatPill label={group.movementType} value={`${group.filledSlots}/${group.totalSlots}`} />
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ background: "#fbfcfc", borderBottom: "1px solid #dce3e2" }}>
                      <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>#</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Club</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6f7e7a" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.slots.map((slot) => (
                      <tr key={slot.id} style={{ borderBottom: "1px solid #eef1f1" }}>
                        <td style={{ padding: "0.6rem 1rem", color: "#6f7e7a", fontSize: "12px" }}>{slot.slotIndex + 1}</td>
                        <td style={{ padding: "0.6rem 1rem" }}>
                          {slot.clubName ? (
                            <span style={{ fontWeight: 600, color: "#17221f" }}>{slot.clubName}</span>
                          ) : (
                            <span style={{ color: "#6f7e7a", fontStyle: "italic" }}>Empty</span>
                          )}
                        </td>
                        <td style={{ padding: "0.6rem 1rem" }}>
                          {slot.clubId === null ? (
                            <form method="post" action={`/api/admin/movements/slots/${slot.id}/fill`} style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center" }}>
                              <input type="hidden" name="csrf" value={csrfToken} />
                              <input type="hidden" name="redirect_tier" value={REDIRECT_TIER} />
                              <input name="club_id" list={`clubs-${group.sourceDivisionId}`} placeholder="Pick club..." style={{ padding: "0.2rem 0.4rem", border: "1px solid #dce3e2", borderRadius: "4px", fontSize: "12px", minWidth: "160px" }} />
                              <datalist id={`clubs-${group.sourceDivisionId}`}>
                                {(clubsByDivision[group.sourceDivisionId] ?? []).map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                              </datalist>
                              <button type="submit" style={{ border: "1px solid #147a4d", borderRadius: "4px", background: "#fff", color: "#147a4d", padding: "0.15rem 0.4rem", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Fill</button>
                            </form>
                          ) : (
                            <form method="post" action={`/api/admin/movements/slots/${slot.id}/unfill`} style={{ display: "inline" }}>
                              <input type="hidden" name="csrf" value={csrfToken} />
                              <input type="hidden" name="redirect_tier" value={REDIRECT_TIER} />
                              <button type="submit" style={{ border: "none", background: "none", color: "#a53a2d", cursor: "pointer", fontSize: "11px", fontWeight: 600, padding: 0 }}>Remove</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {view.totalFilled > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "2px solid #147a4d", padding: "0.75rem 1rem", display: "flex", justifyContent: "center", boxShadow: "0 -2px 8px rgba(0,0,0,0.08)", zIndex: 100 }}>
          <form method="post" action="/api/admin/movements/apply" style={{ display: "inline-flex", gap: "0.75rem", alignItems: "center" }}>
            <input type="hidden" name="csrf" value={csrfToken} />
            <input type="hidden" name="redirect_tier" value={REDIRECT_TIER} />
            <span style={{ fontSize: "14px", color: "#34413e" }}>{view.totalFilled} slot{view.totalFilled !== 1 ? "s" : ""} ready to apply</span>
            <button type="submit" style={{ border: "none", borderRadius: "7px", background: "#147a4d", color: "#fff", padding: "0.5rem 1.5rem", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Apply {view.totalFilled} movement{view.totalFilled !== 1 ? "s" : ""}</button>
          </form>
        </div>
      )}
    </main>
  );
}
