import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { getBatchDetail } from "@/lib/admin/imports";
import type { ImportBatchRow } from "@/lib/import/types";

export const dynamic = "force-dynamic";

const outcomeStyles: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  insert: { bg: "#e8f4f1", fg: "#0e5737", border: "#b8d9cf", label: "Insert" },
  update: { bg: "#e0effa", fg: "#1a5a8a", border: "#b8d4e8", label: "Update" },
  blocked: { bg: "#fde9e5", fg: "#a53a2d", border: "#f0beb7", label: "Blocked" },
  skip: { bg: "#f5f6f6", fg: "#6f7e7a", border: "#dce3e2", label: "Skip" },
  pending: { bg: "#fdf3e9", fg: "#8a5a00", border: "#f0d5b7", label: "Pending" },
};

export default async function AdminImportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();
  const { id } = await params;
  const sp = await searchParams;

  const batchId = parseInt(id, 10);
  if (isNaN(batchId)) {
    return <div>Invalid batch ID.</div>;
  }

  const db = await getDatabase();
  let detail;
  try {
    detail = await getBatchDetail(db, batchId);
  } catch {
    return (
      <main style={{ maxWidth: "48rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
        <p>Batch not found.</p>
        <Link href="/admin/imports">Back to imports</Link>
      </main>
    );
  }

  const { batch, source, grouped } = detail;

  const insertRows = grouped.insert ?? [];
  const updateRows = grouped.update ?? [];
  const blockedRows = grouped.blocked ?? [];
  const skipRows = grouped.skip ?? [];
  const pendingRows = grouped.pending ?? [];
  const applyableCount = insertRows.length + updateRows.length;

  const hasBeenApplied = batch.approvalStatus === "approved" || batch.approvalStatus === "partially_approved";

  const error = sp.error;
  const inserted = sp.inserted;
  const updated = sp.updated;
  const skipped = sp.skipped;

  return (
    <main style={{ maxWidth: "64rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{
        padding: "1.25rem 0",
        borderBottom: "1px solid #dce3e2",
        marginBottom: "1.5rem",
      }}>
        <Link href="/admin/imports" style={{
          color: "#6f7e7a", fontSize: "13px", textDecoration: "none", fontWeight: 600
        }}>&larr; Import batches</Link>
        <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>Batch #{batch.id}</h1>
      </header>

      {error && (
        <div style={{
          border: "1px solid #f0beb7", borderRadius: "8px",
          background: "#fde9e5", padding: "0.75rem 1rem",
          marginBottom: "1rem", color: "#a53a2d", fontSize: "14px"
        }}>
          {error}
        </div>
      )}

      {inserted && (
        <div style={{
          border: "1px solid #b8d9cf", borderRadius: "8px",
          background: "#e8f4f1", padding: "0.75rem 1rem",
          marginBottom: "1rem", color: "#0e5737", fontSize: "14px", fontWeight: 600
        }}>
          Apply complete: {inserted} inserted, {updated ?? 0} updated, {skipped ?? 0} skipped.
        </div>
      )}

      <section style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem" }}>
          <MetaCard label="Source" value={source?.name ?? `Source #${batch.sourceId}`} />
          <MetaCard label="Type" value={batch.adapterType} />
          <MetaCard label="Season" value={batch.seasonLabel ?? "—"} />
          <MetaCard label="Actor" value={batch.actor} />
          <MetaCard label="Parse Status" value={batch.parseStatus} />
          <MetaCard label="Approval" value={batch.approvalStatus} />
          <MetaCard label="Total Rows" value={String(batch.rowCountTotal)} />
          <MetaCard label="Created" value={batch.createdAt ? new Date(batch.createdAt).toLocaleString() : "—"} />
        </div>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <CountBadge count={insertRows.length} label="Insert" bg={outcomeStyles.insert.bg} fg={outcomeStyles.insert.fg} />
          <CountBadge count={updateRows.length} label="Update" bg={outcomeStyles.update.bg} fg={outcomeStyles.update.fg} />
          <CountBadge count={blockedRows.length} label="Blocked" bg={outcomeStyles.blocked.bg} fg={outcomeStyles.blocked.fg} />
          <CountBadge count={skipRows.length} label="Skip" bg={outcomeStyles.skip.bg} fg={outcomeStyles.skip.fg} />
          <CountBadge count={pendingRows.length} label="Pending" bg={outcomeStyles.pending.bg} fg={outcomeStyles.pending.fg} />
        </div>
      </section>

      {!hasBeenApplied && applyableCount > 0 && (
        <section style={{
          border: "1px solid #147a4d", borderRadius: "8px",
          background: "#f0faf6", padding: "1rem", marginBottom: "1.5rem"
        }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "15px", color: "#0e5737" }}>
            {applyableCount} of {batch.rowCountTotal} rows ready to apply.
          </p>
          <form method="post" action={`/api/admin/imports/${batch.id}`} style={{ marginTop: "0.75rem" }}>
            <input type="hidden" name="csrf" value={csrfToken} />
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "14px", cursor: "pointer", marginBottom: "0.75rem" }}>
              <input type="checkbox" name="confirm" value="1" required />
              I confirm that I want to apply these {applyableCount} rows. Blocked rows will be skipped.
            </label>
            <button type="submit" style={{
              border: "1px solid #147a4d", borderRadius: "7px",
              background: "#147a4d", color: "#fff",
              padding: "0.6rem 1.5rem", fontSize: "14px", fontWeight: 700, cursor: "pointer"
            }}>
              Apply safe rows &rarr;
            </button>
          </form>
        </section>
      )}

      {hasBeenApplied && (
        <section style={{
          border: "1px solid #b8d9cf", borderRadius: "8px",
          background: "#e8f4f1", padding: "1rem", marginBottom: "1.5rem"
        }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "15px", color: "#0e5737" }}>
            This batch has been applied. {batch.rowCountApproved} rows were approved.
          </p>
        </section>
      )}

      {blockedRows.length > 0 && (
        <OutcomeGroup title="Blocked" rows={blockedRows} outcome="blocked" />
      )}

      {insertRows.length > 0 && (
        <OutcomeGroup title="Insert" rows={insertRows} outcome="insert" />
      )}

      {updateRows.length > 0 && (
        <OutcomeGroup title="Update" rows={updateRows} outcome="update" />
      )}

      {(skipRows.length > 0 || pendingRows.length > 0) && (
        <OutcomeGroup
          title={skipRows.length > 0 ? "Skipped" : "Pending"}
          rows={[...skipRows, ...pendingRows]}
          outcome="skip"
        />
      )}
    </main>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      border: "1px solid #dce3e2", borderRadius: "6px",
      padding: "0.5rem 0.75rem", background: "#fafbfb"
    }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "#6f7e7a", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "14px", fontWeight: 600, color: "#17221f", marginTop: "0.1rem", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function CountBadge({ count, label, bg, fg }: { count: number; label: string; bg: string; fg: string }) {
  return (
    <div style={{
      border: `1px solid ${bg}`, borderRadius: "6px",
      background: bg, padding: "0.5rem 0.75rem", textAlign: "center", minWidth: "80px"
    }}>
      <div style={{ fontSize: "1.3rem", fontWeight: 700, color: fg }}>{count}</div>
      <div style={{ fontSize: "11px", fontWeight: 600, color: fg, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function OutcomeGroup({ title, rows, outcome }: { title: string; rows: ImportBatchRow[]; outcome: string }) {
  const s = outcomeStyles[outcome] ?? outcomeStyles.pending;
  const defaultOpen = outcome === "blocked";
  return (
    <details open={defaultOpen} style={{
      border: `1px solid ${s.border}`, borderRadius: "8px",
      overflow: "hidden", marginBottom: "0.5rem"
    }}>
      <summary style={{
        padding: "0.6rem 1rem", background: s.bg, cursor: "pointer",
        display: "flex", alignItems: "center", gap: "0.6rem",
        fontWeight: 600, fontSize: "14px", color: "#17221f", userSelect: "none"
      }}>
        <span style={{
          padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "11px", fontWeight: 600,
          background: s.bg, color: s.fg, border: `1px solid ${s.border}`
        }}>{s.label}</span>
        <span>{title}</span>
        <span style={{ color: s.fg, fontWeight: 700, marginLeft: "auto", fontSize: "13px" }}>{rows.length}</span>
      </summary>
      <div style={{ padding: "0.25rem 0" }}>
        {rows.map((row: ImportBatchRow) => (
          <div key={row.id} style={{
            padding: "0.75rem 1rem",
            borderBottom: "1px solid #eef1f1",
            fontSize: "14px"
          }}>
            <div style={{ fontWeight: 600, color: "#17221f" }}>
              {row.homeParticipantRaw ?? "?"} vs {row.awayParticipantRaw ?? "?"}
            </div>
            <div style={{ fontSize: "13px", color: "#6f7e7a", marginTop: "0.2rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {row.kickoffDate && <span>{row.kickoffDate}{row.kickoffTime ? ` ${row.kickoffTime}` : ""}</span>}
              {row.competitionRaw && <span>{row.competitionRaw}</span>}
              {row.venueRaw && <span>{row.venueRaw}</span>}
              {row.finalFixtureId && <span>Fixture #{row.finalFixtureId}</span>}
            </div>
            {row.warningsJson && (
              <div style={{ marginTop: "0.3rem", fontSize: "12px", color: outcome === "blocked" ? "#a53a2d" : "#8a5a00" }}>
                {(() => {
                  try {
                    const parsed = JSON.parse(row.warningsJson);
                    const msgs = parsed.messages ?? [];
                    return (
                      <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem" }}>
                        {msgs.map((m: string, i: number) => <li key={i}>{m}</li>)}
                      </ul>
                    );
                  } catch { return null; }
                })()}
              </div>
            )}
            <div style={{ fontSize: "12px", color: "#6f7e7a", marginTop: "0.2rem" }}>
              match_result: {row.matchResult ?? "pending"} {row.finalAction ? `· final_action: ${row.finalAction}` : ""}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
