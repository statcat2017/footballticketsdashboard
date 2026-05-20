import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { getBatchDetail, getImportPreviewCounts, getImportUpdatePreviews } from "@/lib/admin/imports";
import type { ImportUpdatePreview } from "@/lib/admin/imports";
import type { ImportBatchRow, WarningIssue } from "@/lib/import/types";
import { findImportFixtureCandidateMatches, type FixtureCandidateMatch } from "@/lib/import/fixtureIdentity";
import { MapEditorWrapper } from "@/app/admin/venues/_components/MapEditorWrapper";

export const dynamic = "force-dynamic";

const sInsert = { bg: "#e8f4f1", fg: "#0e5737", border: "#b8d9cf", label: "Insert" };
const sBlocked = { bg: "#fde9e5", fg: "#a53a2d", border: "#f0beb7", label: "Blocked" };
const sSkip = { bg: "#f5f6f6", fg: "#6f7e7a", border: "#dce3e2", label: "Skip" };
const sPending = { bg: "#fdf3e9", fg: "#8a5a00", border: "#f0d5b7", label: "Pending" };
const sImported = { bg: "#e8f4f1", fg: "#0e5737", border: "#b8d9cf", label: "Imported" };

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
  if (isNaN(batchId)) return <div>Invalid batch ID.</div>;

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

  const { batch, source, activeGrouped, finalizedRows } = detail;
  const counts = getImportPreviewCounts(activeGrouped);
  const finalizedInsert = finalizedRows.filter((r) => r.finalAction === "insert" || r.finalAction === "update");
  const finalizedSkip = finalizedRows.filter((r) => r.finalAction === "skip");
  const hasBeenApplied = batch.approvalStatus === "approved" || batch.approvalStatus === "partially_approved";

  const error = sp.error;
  const success = sp.success;

  const insertRows = detail.grouped.insert ?? [];
  const updateRows = detail.grouped.update ?? [];
  const blockedRows = detail.grouped.blocked ?? [];
  const pendingRows = detail.grouped.pending ?? [];
  const duplicateFixtureRows = detail.grouped.duplicate_existing_fixture ?? [];
  const duplicatePendingRows = detail.grouped.duplicate_pending_batch ?? [];
  const duplicateSameBatchRows = detail.grouped.duplicate_same_batch ?? [];
  const applyableCount = insertRows.length + updateRows.length;
  const updatePreviews = await getImportUpdatePreviews(db, updateRows, batch.seasonLabel);

  // Fetch data needed for inline forms
  const clubs = await db.all<{ id: number; name: string }>(`SELECT id, name FROM clubs ORDER BY name`);
  const venues = await db.all<{ id: number; name: string; postcode: string }>(`SELECT id, name, postcode FROM venues ORDER BY name`);
  const competitions = await db.all<{ code: string; name: string; kind: string }>(
    `SELECT code, name, kind FROM competitions ORDER BY name`
  );
  const possibleMatches = new Map<number, FixtureCandidateMatch[]>();
  await Promise.all(blockedRows.map(async (row) => {
    const candidates = await findImportFixtureCandidateMatches(db, row, batch.seasonLabel, 5);
    if (candidates.length > 0) possibleMatches.set(row.id, candidates);
  }));

  // Fetch acknowledged issue keys so ticket acknowledgement has visible effect
  const resolutions = await db.all<{ issue_key: string; row_id: number | null }>(
    `SELECT issue_key, row_id FROM import_batch_issue_resolutions WHERE batch_id = ?`,
    [batchId]
  );
  const acknowledgedKeys = new Set<string>();
  const acknowledgedRowKeys = new Map<number, Set<string>>();
  for (const r of resolutions) {
    if (r.row_id) {
      const rowSet = acknowledgedRowKeys.get(r.row_id) ?? new Set();
      rowSet.add(r.issue_key);
      acknowledgedRowKeys.set(r.row_id, rowSet);
    } else {
      acknowledgedKeys.add(r.issue_key);
    }
  }

  return (
    <main style={{ maxWidth: "64rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{
        padding: "1.25rem 0", borderBottom: "1px solid #dce3e2", marginBottom: "1.5rem",
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
        }}>{error}</div>
      )}

      {success && (
        <div style={{
          border: "1px solid #b8d9cf", borderRadius: "8px",
          background: "#e8f4f1", padding: "0.75rem 1rem",
          marginBottom: "1rem", color: "#0e5737", fontSize: "14px", fontWeight: 600
        }}>{success}</div>
      )}

      {/* Meta */}
      <section style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem" }}>
          <MetaCard label="Source" value={source?.name ?? `Source #${batch.sourceId}`} />
          <MetaCard label="Type" value={batch.adapterType} />
          <MetaCard label="Season" value={batch.seasonLabel ?? "—"} />
          <MetaCard label="Actor" value={batch.actor} />
          <MetaCard label="Parse" value={batch.parseStatus} />
          <MetaCard label="Approval" value={batch.approvalStatus} />
          <MetaCard label="Total Rows" value={String(batch.rowCountTotal)} />
          <MetaCard label="Created" value={batch.createdAt ? new Date(batch.createdAt).toLocaleString() : "—"} />
        </div>
      </section>

      {/* Summary bar */}
      <SummaryBar counts={counts} finalizedInsert={finalizedInsert.length} finalizedSkip={finalizedSkip.length} />

      {/* Needs resolution */}
      {blockedRows.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem", color: "#a53a2d" }}>
            Needs resolution ({blockedRows.length})
          </h2>
          {blockedRows.map((row) => (
            <FixtureCard
              key={row.id}
              row={row}
              csrfToken={csrfToken}
              batchId={batchId}
              mode="blocked"
              clubs={clubs}
              venues={venues}
              competitions={competitions}
              possibleMatches={possibleMatches.get(row.id) ?? []}
              acknowledgedKeys={acknowledgedKeys}
              acknowledgedRowKeys={acknowledgedRowKeys.get(row.id) ?? new Set()}
            />
          ))}
        </section>
      )}

      {/* Ready to import */}
      {(insertRows.length > 0 || updateRows.length > 0) && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem", color: "#0e5737" }}>
            Ready to import ({insertRows.length} insert, {updateRows.length} update)
          </h2>

          {insertRows.length > 0 && (
            <>
              <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem", color: "#0e5737" }}>Insert ({insertRows.length})</h3>
              {insertRows.map((row) => (
                <FixtureCard
                  key={row.id}
                  row={row}
                  csrfToken={csrfToken}
                  batchId={batchId}
                  mode="ready"
                  clubs={clubs}
                  venues={venues}
                  competitions={competitions}
                  possibleMatches={possibleMatches.get(row.id) ?? []}
                  acknowledgedKeys={acknowledgedKeys}
                  acknowledgedRowKeys={acknowledgedRowKeys.get(row.id) ?? new Set()}
                />
              ))}
            </>
          )}

          {updateRows.length > 0 && (
            <>
              <h3 style={{ fontSize: "0.95rem", margin: insertRows.length > 0 ? "1rem 0 0.5rem" : "0 0 0.5rem", color: "#0e5737" }}>Update ({updateRows.length})</h3>
              {updateRows.map((row) => (
                <FixtureCard
                  key={row.id}
                  row={row}
                  csrfToken={csrfToken}
                  batchId={batchId}
                  mode="ready"
                  clubs={clubs}
                  venues={venues}
                  competitions={competitions}
                  possibleMatches={possibleMatches.get(row.id) ?? []}
                  acknowledgedKeys={acknowledgedKeys}
                  acknowledgedRowKeys={acknowledgedRowKeys.get(row.id) ?? new Set()}
                  updatePreview={updatePreviews.get(row.id)}
                />
              ))}
            </>
          )}

          {applyableCount > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <BulkApplyForm batchId={batchId} csrfToken={csrfToken} applyableCount={applyableCount} />
            </div>
          )}
        </section>
      )}

      {/* Pending */}
      {pendingRows.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem", color: "#8a5a00" }}>
            Pending ({pendingRows.length})
          </h2>
          {pendingRows.map((row) => (
            <FixtureCard
              key={row.id}
              row={row}
              csrfToken={csrfToken}
              batchId={batchId}
              mode="pending"
              clubs={clubs}
              venues={venues}
              competitions={competitions}
              possibleMatches={possibleMatches.get(row.id) ?? []}
              acknowledgedKeys={acknowledgedKeys}
              acknowledgedRowKeys={acknowledgedRowKeys.get(row.id) ?? new Set()}
            />
          ))}
        </section>
      )}

      {/* Duplicate — already imported */}
      {duplicateFixtureRows.length > 0 && (
        <details style={{ marginBottom: "0.75rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "14px", padding: "0.5rem 0", color: "#6f7e7a" }}>
            Already imported ({duplicateFixtureRows.length})
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {duplicateFixtureRows.map((row) => (
              <DuplicateRow key={row.id} row={row} />
            ))}
          </div>
        </details>
      )}

      {/* Duplicate — already in another batch */}
      {duplicatePendingRows.length > 0 && (
        <details style={{ marginBottom: "0.75rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "14px", padding: "0.5rem 0", color: "#8a5a00" }}>
            Already in another batch ({duplicatePendingRows.length})
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {duplicatePendingRows.map((row) => (
              <DuplicateRow key={row.id} row={row} />
            ))}
          </div>
        </details>
      )}

      {/* Duplicate — same batch */}
      {duplicateSameBatchRows.length > 0 && (
        <details style={{ marginBottom: "0.75rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "14px", padding: "0.5rem 0", color: "#6f7e7a" }}>
            Duplicate rows in this batch ({duplicateSameBatchRows.length})
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {duplicateSameBatchRows.map((row) => (
              <DuplicateRow key={row.id} row={row} />
            ))}
          </div>
        </details>
      )}

      {/* Imported history */}
      {finalizedInsert.length > 0 && (
        <details style={{ marginBottom: "0.5rem" }}>
          <summary style={{
            cursor: "pointer", fontWeight: 600, fontSize: "14px",
            padding: "0.5rem 0", color: "#0e5737"
          }}>
            Imported ({finalizedInsert.length})
          </summary>
          {finalizedInsert.map((row) => (
            <FinalizedRow key={row.id} row={row} batchId={batchId} />
          ))}
        </details>
      )}

      {/* Skipped history */}
      {finalizedSkip.length > 0 && (
        <details style={{ marginBottom: "0.5rem" }}>
          <summary style={{
            cursor: "pointer", fontWeight: 600, fontSize: "14px",
            padding: "0.5rem 0", color: "#6f7e7a"
          }}>
            Skipped ({finalizedSkip.length})
          </summary>
          {finalizedSkip.map((row) => (
            <FinalizedRow key={row.id} row={row} batchId={batchId} />
          ))}
        </details>
      )}

      {/* Danger zone delete */}
      {!hasBeenApplied && (
        <DangerZone batchId={batchId} csrfToken={csrfToken} />
      )}
    </main>
  );
}

/* ── Components ── */

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

function SummaryBar({ counts, finalizedInsert, finalizedSkip }: {
  counts: { insert: number; update: number; blocked: number; skipped: number; pending: number };
  finalizedInsert: number;
  finalizedSkip: number;
}) {
  return (
    <div style={{
      display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem"
    }}>
      {counts.blocked > 0 && (
        <SummaryBadge count={counts.blocked} label="Blocked" bg={sBlocked.bg} fg={sBlocked.fg} />
      )}
      {counts.insert > 0 && (
        <SummaryBadge count={counts.insert} label="Insert" bg={sInsert.bg} fg={sInsert.fg} />
      )}
      {counts.update > 0 && (
        <SummaryBadge count={counts.update} label="Update" bg={sInsert.bg} fg={sInsert.fg} />
      )}
      {counts.skipped > 0 && (
        <SummaryBadge count={counts.skipped} label="Skipped" bg={sSkip.bg} fg={sSkip.fg} />
      )}
      {counts.pending > 0 && (
        <SummaryBadge count={counts.pending} label="Pending" bg={sPending.bg} fg={sPending.fg} />
      )}
      {finalizedInsert > 0 && (
        <SummaryBadge count={finalizedInsert} label="Imported" bg={sImported.bg} fg={sImported.fg} />
      )}
      {finalizedSkip > 0 && (
        <SummaryBadge count={finalizedSkip} label="Skipped" bg={sSkip.bg} fg={sSkip.fg} />
      )}
    </div>
  );
}

function SummaryBadge({ count, label, bg, fg }: { count: number; label: string; bg: string; fg: string }) {
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

function FixtureCard({ row, csrfToken, batchId, mode, clubs, venues, competitions, possibleMatches, acknowledgedKeys, acknowledgedRowKeys, updatePreview }: {
  row: ImportBatchRow;
  csrfToken: string;
  batchId: number;
  mode: "blocked" | "ready" | "pending";
  clubs: { id: number; name: string }[];
  venues: { id: number; name: string; postcode: string }[];
  competitions: { code: string; name: string; kind: string }[];
  possibleMatches?: FixtureCandidateMatch[];
  acknowledgedKeys: Set<string>;
  acknowledgedRowKeys: Set<string>;
  updatePreview?: ImportUpdatePreview;
}) {
  const warnings = parseWarnings(row.warningsJson);
  const blockers = warnings.filter((w) => w.severity === "blocker");
  const nonBlockers = warnings.filter((w) => w.severity === "warning");

  const filteredBlockers = blockers.filter((w) => {
    if (acknowledgedKeys.has(w.issueKey)) return false;
    if (acknowledgedRowKeys.has(w.issueKey)) return false;
    return true;
  });
  const filteredNonBlockers = nonBlockers.filter((w) => {
    if (acknowledgedKeys.has(w.issueKey)) return false;
    if (acknowledgedRowKeys.has(w.issueKey)) return false;
    return true;
  });

  const uniqueBlockers = dedupeIssues(filteredBlockers);
  const uniqueWarnings = dedupeIssues(filteredNonBlockers);

  const blockerMap = new Map(uniqueBlockers.map((w) => [w.code, w]));
  const warningMap = new Map(uniqueWarnings.map((w) => [w.code, w]));

  const homeClub = clubs.find((c) => c.id === row.homeParticipantResolvedId);
  const awayClub = clubs.find((c) => c.id === row.awayParticipantResolvedId);
  const resolvedVenue = venues.find((v) => v.id === row.venueResolvedId);

  interface ChecklistItem {
    field: string;
    status: "resolved" | "warning" | "blocked" | "missing";
    value: string;
    message: string;
  }

  const checklist: ChecklistItem[] = [];

  // Home club
  if (homeClub) {
    checklist.push({ field: "Home", status: "resolved", value: homeClub.name, message: "" });
  } else if (blockerMap.has("unknown_club")) {
    const raw = row.homeParticipantRaw ?? blockerMap.get("unknown_club")?.rawValue ?? "Unknown";
    checklist.push({ field: "Home", status: "blocked", value: raw, message: blockerMap.get("unknown_club")!.message });
  } else {
    checklist.push({ field: "Home", status: "blocked", value: row.homeParticipantRaw ?? "?", message: "Home club not resolved" });
  }

  // Away club
  if (awayClub) {
    checklist.push({ field: "Away", status: "resolved", value: awayClub.name, message: "" });
  } else if (row.awayIsOneOff && row.awayParticipantRaw) {
    checklist.push({ field: "Away", status: "resolved", value: `${row.awayParticipantRaw} (one-off)`, message: "" });
  } else if (blockerMap.has("unknown_club")) {
    const blocker = blockerMap.get("unknown_club")!;
    const raw = row.awayParticipantRaw ?? blocker.rawValue ?? "Unknown";
    checklist.push({ field: "Away", status: "blocked", value: raw, message: blocker.message });
  } else if (blockerMap.has("ambiguous_club")) {
    checklist.push({ field: "Away", status: "blocked", value: row.awayParticipantRaw ?? "?", message: blockerMap.get("ambiguous_club")!.message });
  } else {
    checklist.push({ field: "Away", status: "missing", value: row.awayParticipantRaw ?? "?", message: "" });
  }

  // Competition
  if (row.competitionResolvedCode) {
    const comp = competitions.find((c) => c.code === row.competitionResolvedCode);
    checklist.push({ field: "Competition", status: "resolved", value: comp ? comp.name : row.competitionResolvedCode, message: "" });
  } else if (blockerMap.has("unknown_competition") || blockerMap.has("missing_competition")) {
    const blocker = blockerMap.get("unknown_competition") ?? blockerMap.get("missing_competition")!;
    checklist.push({ field: "Competition", status: "blocked", value: row.competitionRaw ?? "?", message: blocker.message });
  } else {
    checklist.push({ field: "Competition", status: "missing", value: row.competitionRaw ?? "?", message: "" });
  }

  // Venue
  if (resolvedVenue) {
    const isDefaulted = row.venueRaw && !venues.some((v) => v.name === row.venueRaw);
    checklist.push({
      field: "Venue", status: isDefaulted ? "warning" : "resolved",
      value: isDefaulted ? `${resolvedVenue.name} (defaulted from home club)` : resolvedVenue.name,
      message: warningMap.get("venue_not_found")?.message ?? ""
    });
  } else if (blockerMap.has("missing_primary_venue")) {
    checklist.push({ field: "Venue", status: "blocked", value: "No venue", message: blockerMap.get("missing_primary_venue")!.message });
  } else if (blockerMap.has("one_off_needs_venue")) {
    checklist.push({ field: "Venue", status: "blocked", value: "No venue", message: blockerMap.get("one_off_needs_venue")!.message });
  } else if (row.venueRaw) {
    checklist.push({ field: "Venue", status: "warning", value: row.venueRaw, message: "Venue name not matched" });
  } else {
    checklist.push({ field: "Venue", status: "missing", value: "Not set", message: "" });
  }

  // Date & Time
  if (!row.kickoffDate) {
    checklist.push({ field: "Date", status: "blocked", value: "Not set", message: blockerMap.get("missing_date")?.message ?? "Missing fixture date" });
  } else if (blockerMap.has("invalid_date")) {
    checklist.push({ field: "Date", status: "blocked", value: row.kickoffDate, message: blockerMap.get("invalid_date")!.message });
  } else {
    const timeStr = row.kickoffTime ?? (warningMap.has("assumed_time") ? "(assumed)" : "");
    const hasAssumed = warningMap.has("assumed_time");
    checklist.push({
      field: "Date", status: hasAssumed ? "warning" : "resolved",
      value: `${row.kickoffDate}${timeStr ? ` ${timeStr}` : ""}`,
      message: warningMap.get("assumed_time")?.message ?? ""
    });
  }

  // Tickets
  if (row.ticketUrl) {
    checklist.push({ field: "Tickets", status: "resolved", value: "Provided", message: "" });
  } else if (warningMap.has("missing_ticket_info")) {
    checklist.push({ field: "Tickets", status: "warning", value: "Not provided", message: warningMap.get("missing_ticket_info")!.message });
  } else {
    checklist.push({ field: "Tickets", status: "missing", value: "Not provided", message: "" });
  }

  function statusIcon(status: string): string {
    switch (status) {
      case "resolved": return "\u2705";
      case "warning": return "\u26A0\uFE0F";
      case "blocked": return "\u274C";
      case "missing": return "\u26AA";
      default: return "\u2753";
    }
  }

  function statusColor(status: string): string {
    switch (status) {
      case "resolved": return "#0e5737";
      case "warning": return "#8a5a00";
      case "blocked": return "#a53a2d";
      default: return "#6f7e7a";
    }
  }

  const showRepairForms = mode === "blocked" && uniqueBlockers.length > 0;
  const updatePreviewRows = updatePreview ? buildUpdatePreviewRows(row, updatePreview, venues) : [];

  return (
    <div id={`fixture-${row.id}`} style={{
      border: `1px solid ${mode === "blocked" ? sBlocked.border : mode === "pending" ? sPending.border : sInsert.border}`,
      borderRadius: "8px", overflow: "hidden", marginBottom: "0.75rem"
    }}>
      {/* Card header */}
      <div style={{
        padding: "0.6rem 1rem",
        background: mode === "blocked" ? sBlocked.bg : mode === "pending" ? sPending.bg : sInsert.bg,
        display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "14px", fontWeight: 600
      }}>
        <span>{row.homeParticipantRaw ?? "?"} vs {row.awayParticipantRaw ?? "?"}</span>
      </div>

      {/* Checklist */}
      <div style={{ padding: "0.5rem 1rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <tbody>
            {checklist.map((item, i) => (
              <tr key={item.field}
                style={i < checklist.length - 1 ? { borderBottom: "1px solid #f0f1f1" } : undefined}
              >
                <td style={{
                  padding: "0.35rem 0.5rem 0.35rem 0", whiteSpace: "nowrap",
                  fontWeight: 600, color: "#6f7e7a", width: "100px"
                }}>
                  {item.field}
                </td>
                <td style={{
                  padding: "0.35rem 0.5rem", color: statusColor(item.status),
                  fontWeight: 500, width: "28px"
                }}>
                  {statusIcon(item.status)}
                </td>
                <td style={{ padding: "0.35rem 0.5rem", color: "#17221f", fontWeight: 500 }}>
                  {item.value}
                </td>
                <td style={{ padding: "0.35rem 0 0.35rem 0.5rem", color: statusColor(item.status), fontSize: "12px" }}>
                  {item.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {updatePreviewRows.length > 0 && (
        <div style={{ padding: "0.5rem 1rem", borderTop: "1px solid #f0f1f1", background: "#fafbfb" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#0e5737", marginBottom: "0.35rem" }}>
            Updating fixture #{updatePreview?.fixtureId}: current vs proposed
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ color: "#6f7e7a", textAlign: "left" }}>
                <th style={{ padding: "0.25rem 0.5rem 0.25rem 0" }}>Field</th>
                <th style={{ padding: "0.25rem 0.5rem" }}>Current</th>
                <th style={{ padding: "0.25rem 0.5rem" }}>Proposed</th>
              </tr>
            </thead>
            <tbody>
              {updatePreviewRows.map((previewRow) => (
                <tr key={previewRow.field} style={{ borderTop: "1px solid #eef1f1" }}>
                  <td style={{ padding: "0.3rem 0.5rem 0.3rem 0", fontWeight: 700, color: "#6f7e7a" }}>{previewRow.field}</td>
                  <td style={{ padding: "0.3rem 0.5rem", color: "#17221f" }}>{previewRow.current}</td>
                  <td style={{ padding: "0.3rem 0.5rem", color: "#0e5737", fontWeight: 600 }}>{previewRow.proposed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mode === "blocked" && possibleMatches.length > 0 && (
        <PossibleMatchesSection candidates={possibleMatches} />
      )}

      {/* Inline repair forms for blocked items */}
      {showRepairForms && (
        <div style={{ padding: "0 1rem 0.75rem", borderTop: "1px solid #f0f1f1" }}>
          {uniqueBlockers.map((issue, i) => (
            <div key={i} style={{ marginTop: "0.5rem" }}>
              <IssueRepair
                issue={issue}
                rowId={row.id}
                batchId={batchId}
                csrfToken={csrfToken}
                homeResolvedId={row.homeParticipantResolvedId}
                competitionResolvedCode={row.competitionResolvedCode}
                clubs={clubs}
                venues={venues}
                competitions={competitions}
              />
            </div>
          ))}
        </div>
      )}

      {/* Ticket info repair form inline (for ready/blocked with missing tickets) */}
      {(mode === "ready" || mode === "blocked") && warningMap.has("missing_ticket_info") && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <TicketRepairForm rowId={row.id} batchId={batchId} csrfToken={csrfToken}
            homeResolvedId={row.homeParticipantResolvedId} />
        </div>
      )}

      {/* Actions */}
      {mode === "ready" && (
        <div style={{
          padding: "0.5rem 1rem", borderTop: "1px solid #eef1f1",
          display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap"
        }}>
          <form method="post" action={`/api/admin/imports/${batchId}/repairs`} style={{ display: "inline" }}>
            <input type="hidden" name="csrf" value={csrfToken} />
            <input type="hidden" name="_action" value="import_row" />
            <input type="hidden" name="row_id" value={row.id} />
            <button type="submit" style={{
              border: "1px solid #147a4d", borderRadius: "6px",
              background: "#147a4d", color: "#fff",
              padding: "0.4rem 1rem", fontSize: "13px", fontWeight: 700, cursor: "pointer"
            }}>Import this fixture</button>
          </form>

          <SkipForm rowId={row.id} batchId={batchId} csrfToken={csrfToken} />

          <details style={{ display: "inline-block" }}>
            <summary style={{
              cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#6f7e7a", padding: "0.25rem 0.5rem"
            }}>Edit fields</summary>
            <RowEditForm rowId={row.id} batchId={batchId} csrfToken={csrfToken} row={row} competitions={competitions} />
          </details>
        </div>
      )}

      {mode === "blocked" && (
        <div style={{
          padding: "0.5rem 1rem", borderTop: "1px solid #eef1f1",
          display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap"
        }}>
          <SkipForm rowId={row.id} batchId={batchId} csrfToken={csrfToken} />

          <details style={{ display: "inline-block" }}>
            <summary style={{
              cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#6f7e7a", padding: "0.25rem 0.5rem"
            }}>Edit fields</summary>
            <RowEditForm rowId={row.id} batchId={batchId} csrfToken={csrfToken} row={row} competitions={competitions} />
          </details>
        </div>
      )}
    </div>
  );
}

function dedupeIssues(issues: WarningIssue[]): WarningIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = i.issueKey;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildUpdatePreviewRows(
  row: ImportBatchRow,
  preview: ImportUpdatePreview,
  venues: { id: number; name: string; postcode: string }[],
): Array<{ field: string; current: string; proposed: string }> {
  const before = preview.before;
  const rows: Array<{ field: string; current: string; proposed: string }> = [];

  const venueName = (value: unknown) => {
    if (typeof value !== "number") return formatEmpty(value);
    return venues.find((v) => v.id === value)?.name ?? `Venue #${value}`;
  };

  rows.push({ field: "Venue", current: venueName(before.venue_id), proposed: venueName(row.venueResolvedId) });
  rows.push({ field: "Kickoff date", current: formatEmpty(before.fixture_date), proposed: formatEmpty(row.kickoffDate) });
  rows.push({ field: "Kickoff time", current: formatKickoffTime(before.kickoff_time, before.kickoff_time_status), proposed: formatKickoffTime(row.kickoffTime, row.kickoffTime ? "confirmed" : null) });
  rows.push({ field: "Status", current: formatEmpty(before.status), proposed: formatEmpty(row.status) });

  if (row.ticketUrl || before.ticket_url) {
    rows.push({ field: "Ticket URL", current: formatEmpty(before.ticket_url), proposed: formatEmpty(row.ticketUrl) });
  }
  if (row.adultPricePence !== null || before.adult_price_pence !== undefined) {
    rows.push({ field: "Adult price", current: formatPence(before.adult_price_pence), proposed: formatPence(row.adultPricePence) });
  }
  if (row.concessionPricePence !== null || before.concession_price_pence !== undefined) {
    rows.push({ field: "Concession price", current: formatPence(before.concession_price_pence), proposed: formatPence(row.concessionPricePence) });
  }

  return rows.filter((previewRow) => previewRow.current !== previewRow.proposed);
}

function formatKickoffTime(value: unknown, status: unknown): string {
  const formatted = formatEmpty(value);
  if (formatted === "—") return formatted;
  return typeof status === "string" && status ? `${formatted} (${status})` : formatted;
}

function formatPence(value: unknown): string {
  return typeof value === "number" ? `£${(value / 100).toFixed(2)}` : "—";
}

function formatEmpty(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function parseWarnings(json: string | null): WarningIssue[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as { issues?: WarningIssue[] };
    return parsed.issues ?? [];
  } catch { return []; }
}

function PossibleMatchesSection({ candidates }: { candidates: FixtureCandidateMatch[] }) {
  return (
    <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #f0f1f1", background: "#fafbfb" }}>
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "13px", color: "#34413e" }}>Possible matches</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
        <thead>
          <tr style={{ color: "#6f7e7a", textAlign: "left" }}>
            <th style={{ padding: "0.25rem 0.5rem 0.25rem 0" }}>Fixture</th>
            <th style={{ padding: "0.25rem 0.5rem" }}>Venue</th>
            <th style={{ padding: "0.25rem 0.5rem" }}>Date</th>
            <th style={{ padding: "0.25rem 0" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr key={candidate.id} style={{ borderTop: "1px solid #eef1f1" }}>
              <td style={{ padding: "0.35rem 0.5rem 0.35rem 0", fontWeight: 600, color: "#17221f" }}>
                #{candidate.id} {candidate.homeName} vs {candidate.awayName}
              </td>
              <td style={{ padding: "0.35rem 0.5rem", color: "#34413e" }}>{candidate.venueName ?? "-"}</td>
              <td style={{ padding: "0.35rem 0.5rem", color: "#34413e" }}>{formatCandidateKickoff(candidate)}</td>
              <td style={{ padding: "0.35rem 0", color: "#34413e" }}>{candidate.status ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: "0.5rem 0 0", fontSize: "12px", color: "#6f7e7a" }}>
        Suggestions use the same fixture identity fields as import matching. Choosing an existing fixture is a follow-up because the current repair route only edits/imports/skips rows.
      </p>
    </div>
  );
}

function formatCandidateKickoff(candidate: FixtureCandidateMatch): string {
  if (!candidate.fixtureDate) return "-";
  return candidate.kickoffTime ? `${candidate.fixtureDate} ${candidate.kickoffTime}` : candidate.fixtureDate;
}

/* ── Issue Repair Forms ── */

function IssueRepair({ issue, rowId, batchId, csrfToken, homeResolvedId, competitionResolvedCode, clubs, venues, competitions }: {
  issue: WarningIssue;
  rowId: number;
  batchId: number;
  csrfToken: string;
  homeResolvedId: number | null;
  competitionResolvedCode: string | null;
  clubs: { id: number; name: string }[];
  venues: { id: number; name: string; postcode: string }[];
  competitions?: { code: string; name: string; kind: string }[];
}) {
  switch (issue.code) {
    case "unknown_competition":
      return <CompetitionRepairForm csrfToken={csrfToken} batchId={batchId} rowId={rowId} rawValue={issue.rawValue ?? ""} competitions={competitions ?? []} />;
    case "unknown_club":
      return (
        <div>
          <MatchClubForm csrfToken={csrfToken} batchId={batchId} rowId={rowId} rawValue={issue.rawValue ?? ""}
            competitionCode={competitionResolvedCode} clubs={clubs} />
          <CreateClubForm csrfToken={csrfToken} batchId={batchId} rowId={rowId} rawValue={issue.rawValue ?? ""}
            venues={venues} />
        </div>
      );
    case "missing_primary_venue":
      return <VenueRepairForm csrfToken={csrfToken} batchId={batchId} rowId={rowId}
        clubId={homeResolvedId} venues={venues} />;
    default:
      return null;
  }
}

function CompetitionRepairForm({ csrfToken, batchId, rowId, rawValue, competitions }: {
  csrfToken: string; batchId: number; rowId: number; rawValue: string;
  competitions: { code: string; name: string; kind: string }[];
}) {
  const code = rawValue.replace(/[^a-z0-9]/gi, "_").toUpperCase();
  const compDefault = (() => {
    const match = competitions.find(
      (c) => c.code === rawValue || c.name === rawValue
    );
    return match?.code ?? "";
  })();
  return (
    <div style={{ marginTop: "0.25rem" }}>
      {/* Select existing competition or friendly */}
      <form method="post" action={`/api/admin/imports/${batchId}/repairs`} style={{
        display: "grid", gap: "0.5rem",
        padding: "0.75rem", background: "#fafbfb", borderRadius: "6px",
        border: "1px solid #dce3e2"
      }}>
        <input type="hidden" name="csrf" value={csrfToken} />
        <input type="hidden" name="_action" value="edit_row" />
        <input type="hidden" name="row_id" value={rowId} />

        <label style={labelStyle}>Competition
          <select name="competitionRaw" defaultValue={compDefault} style={inputStyle} id={`comp-select-${rowId}`}>
            <option value="">-- Select competition --</option>
            {competitions.map((c) => (
              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input type="checkbox" name="isFriendly" value="1" style={{ transform: "scale(1.2)" }} />
          This is a friendly (no formal competition)
        </label>

        <button type="submit" style={greenBtnStyle}>Set competition & revalidate</button>
      </form>

      {/* Create formal competition (advanced) */}
      <details style={{ marginTop: "0.5rem" }}>
        <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#6f7e7a" }}>
          Create new competition instead
        </summary>
        <form method="post" action={`/api/admin/imports/${batchId}/repairs`} style={{
          marginTop: "0.5rem", display: "grid", gap: "0.5rem",
          padding: "0.75rem", background: "#fafbfb", borderRadius: "6px",
          border: "1px solid #dce3e2"
        }}>
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="_action" value="create_competition" />
          <input type="hidden" name="redirect_row_id" value={rowId} />

          <label style={labelStyle}>Code
            <input name="code" defaultValue={code} style={inputStyle} />
          </label>
          <label style={labelStyle}>Name
            <input name="name" defaultValue={rawValue} style={inputStyle} />
          </label>
          <label style={labelStyle}>Kind
            <select name="kind" defaultValue="cup" style={inputStyle}>
              <option value="cup">Cup</option>
              <option value="league">League</option>
            </select>
          </label>
          <label style={labelStyle}>Tier <span style={{ fontWeight: 400, color: "#6f7e7a" }}>(only used for league)</span>
            <input name="tier" type="number" min="1" max="10" defaultValue={code.startsWith("T") ? code.slice(1) : "7"} style={inputStyle} />
          </label>
          <button type="submit" style={greenBtnStyle}>Create & revalidate batch</button>
        </form>
      </details>
    </div>
  );
}

function MatchClubForm({ csrfToken, batchId, rowId, rawValue, competitionCode, clubs }: {
  csrfToken: string; batchId: number; rowId: number; rawValue: string;
  competitionCode: string | null;
  clubs: { id: number; name: string }[];
}) {
  return (
    <details style={{ marginTop: "0.25rem" }}>
      <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#147a4d" }}>
        Fix: Match club
      </summary>
      <form method="post" action={`/api/admin/imports/${batchId}/repairs`} style={{
        marginTop: "0.5rem", display: "grid", gap: "0.5rem",
        padding: "0.75rem", background: "#fafbfb", borderRadius: "6px",
        border: "1px solid #dce3e2", maxWidth: "400px"
      }}>
        <input type="hidden" name="csrf" value={csrfToken} />
        <input type="hidden" name="_action" value="match_existing_club" />
        <input type="hidden" name="redirect_row_id" value={rowId} />

        <label style={labelStyle}>Alias (raw name from import)
          <input name="alias" defaultValue={rawValue} style={inputStyle} />
        </label>
        <label style={labelStyle}>Match to club
          <select name="club_id" required style={inputStyle}>
            <option value="">Select club...</option>
            {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Scope
          <select name="competition_code" style={inputStyle}>
            <option value="">Global (unscoped)</option>
            {competitionCode && <option value={competitionCode}>{competitionCode}</option>}
          </select>
        </label>
        <button type="submit" style={greenBtnStyle}>Add alias & revalidate</button>
      </form>
    </details>
  );
}

function CreateClubForm({ csrfToken, batchId, rowId, rawValue, venues }: {
  csrfToken: string; batchId: number; rowId: number; rawValue: string;
  venues: { id: number; name: string; postcode: string }[];
}) {
  const p = "create_venue_";
  const latId = `${p}lat-${rowId}`;
  const lngId = `${p}lng-${rowId}`;
  const approxId = `${p}approx-${rowId}`;
  const precId = `${p}precision-${rowId}`;
  return (
    <details style={{ marginTop: "0.25rem" }}>
      <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#a53a2d" }}>
        Fix: Create new club
      </summary>
        <form method="post" action={`/api/admin/imports/${batchId}/repairs`} style={{
          marginTop: "0.5rem", display: "grid", gap: "0.5rem",
          padding: "0.75rem", background: "#fafbfb", borderRadius: "6px",
          border: "1px solid #dce3e2"
        }}>
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="_action" value="create_club" />
        <input type="hidden" name="redirect_row_id" value={rowId} />
        <input type="hidden" name="alias" value={rawValue} />

        <label style={labelStyle}>Club name
          <input name="name" defaultValue={rawValue} required style={inputStyle} />
        </label>

        <fieldset style={{ border: "1px solid #dce3e2", borderRadius: "6px", padding: "0.5rem", margin: 0 }}>
          <legend style={{ fontSize: "12px", fontWeight: 600, color: "#34413e" }}>Venue</legend>
            <label style={labelStyle}>Use existing venue
            <select name="venue_id" style={inputStyle}>
              <option value="">-- Create new venue below --</option>
              {venues.map((v) => <option key={v.id} value={v.id}>#{v.id} {v.name}, {v.postcode}</option>)}
            </select>
          </label>

          <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.4rem" }}>
            <label style={labelStyle}>New venue name
              <input name={`${p}name`} style={inputStyle} />
            </label>

            <MapEditorWrapper
              isApproximate={false}
              latInputId={latId}
              lngInputId={lngId}
              approxInputId={approxId}
              precisionInputId={precId}
              mode="create"
              postcodeName={`${p}postcode`}
            />

            <input id={latId} name={`${p}latitude`} type="number" step="any" style={{ ...inputStyle, display: "none" }} />
            <input id={lngId} name={`${p}longitude`} type="number" step="any" style={{ ...inputStyle, display: "none" }} />
            <input id={approxId} name={`${p}is_approximate`} type="checkbox" value="1" defaultChecked style={{ display: "none" }} />
            <select id={precId} name={`${p}coordinate_precision`} style={{ ...inputStyle, display: "none" }} defaultValue="ground_approximate">
              <option value="ground_approximate" />
            </select>

            <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input name={`${p}set_primary`} type="checkbox" value="1" defaultChecked />
              Set as home club&apos;s primary venue
            </label>
          </div>
        </fieldset>

        <button type="submit" style={greenBtnStyle}>Create club & revalidate</button>
      </form>
    </details>
  );
}

function VenueRepairForm({ csrfToken, batchId, rowId, clubId, venues }: {
  csrfToken: string; batchId: number; rowId: number; clubId: number | null;
  venues: { id: number; name: string; postcode: string }[];
}) {
  const latId = `crv-lat-${rowId}`;
  const lngId = `crv-lng-${rowId}`;
  const approxId = `crv-approx-${rowId}`;
  const precId = `crv-precision-${rowId}`;
  return (
    <div style={{ marginTop: "0.25rem" }}>
      <details>
        <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#147a4d" }}>
          Fix: Assign existing venue
        </summary>
        <form method="post" action={`/api/admin/imports/${batchId}/repairs`} style={{
          marginTop: "0.5rem", display: "grid", gap: "0.5rem",
          padding: "0.75rem", background: "#fafbfb", borderRadius: "6px",
          border: "1px solid #dce3e2"
        }}>
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="_action" value="assign_existing_venue" />
          <input type="hidden" name="redirect_row_id" value={rowId} />
          {clubId && <input type="hidden" name="club_id" value={clubId} />}

          <label style={labelStyle}>Venue
            <select name="venue_id" required style={inputStyle}>
              <option value="">Select venue...</option>
              {venues.map((v) => <option key={v.id} value={v.id}>#{v.id} {v.name}, {v.postcode}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Effective from
            <input name="effective_from" type="date" style={inputStyle}
              defaultValue={new Date(new Date().getFullYear(), 6, 1).toISOString().split("T")[0]} />
          </label>
          <button type="submit" style={greenBtnStyle}>Assign venue & revalidate</button>
        </form>
      </details>
      <details>
        <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#a53a2d" }}>
          Fix: Create venue and assign to home club
        </summary>
        <form method="post" action={`/api/admin/imports/${batchId}/repairs`} style={{
          marginTop: "0.5rem", display: "grid", gap: "0.5rem",
          padding: "0.75rem", background: "#fafbfb", borderRadius: "6px",
          border: "1px solid #dce3e2"
        }}>
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="_action" value="create_venue_and_assign" />
          <input type="hidden" name="redirect_row_id" value={rowId} />
          {clubId && <input type="hidden" name="club_id" value={clubId} />}

          <label style={labelStyle}>Venue name
            <input name="name" required style={inputStyle} />
          </label>
          <label style={labelStyle}>Postcode
            <input name="postcode" required style={inputStyle} placeholder="e.g. SW1A 1AA" />
          </label>

          <MapEditorWrapper
            isApproximate={false}
            latInputId={latId}
            lngInputId={lngId}
            approxInputId={approxId}
            precisionInputId={precId}
            mode="create"
          />

          <input id={latId} name="latitude" type="number" step="any" required style={{ ...inputStyle, display: "none" }} />
          <input id={lngId} name="longitude" type="number" step="any" required style={{ ...inputStyle, display: "none" }} />
          <input id={approxId} name="is_approximate" type="checkbox" value="1" style={{ display: "none" }} />
          <select id={precId} name="coordinate_precision" style={{ ...inputStyle, display: "none" }} defaultValue="ground_approximate">
            <option value="ground_approximate" />
          </select>

          <label style={labelStyle}>Effective from
            <input name="effective_from" type="date" style={inputStyle}
              defaultValue={new Date(new Date().getFullYear(), 6, 1).toISOString().split("T")[0]} />
          </label>
          <button type="submit" style={greenBtnStyle}>Create venue, assign & revalidate</button>
        </form>
      </details>
    </div>
  );
}

function TicketRepairForm({ rowId, batchId, csrfToken, homeResolvedId }: {
  rowId: number; batchId: number; csrfToken: string; homeResolvedId: number | null;
}) {
  return (
    <div style={{
      marginTop: "0.25rem", padding: "0.5rem", background: "#fafbfb", borderRadius: "6px",
      border: "1px solid #dce3e2", maxWidth: "400px"
    }}>
      <form method="post" action={`/api/admin/imports/${batchId}/repairs`} style={{ display: "grid", gap: "0.5rem" }}>
        <input type="hidden" name="csrf" value={csrfToken} />
        <input type="hidden" name="_action" value="add_club_ticket_info" />
        <input type="hidden" name="redirect_row_id" value={rowId} />
        {homeResolvedId && <input type="hidden" name="club_id" value={homeResolvedId} />}

        <label style={labelStyle}>Ticket URL (required)
          <input name="generic_ticket_url" type="url" required style={inputStyle} />
        </label>
        <label style={labelStyle}>Sale mode
          <select name="sale_mode" style={inputStyle}>
            <option value="">Unknown</option>
            <option value="all_ticket">All ticket</option>
            <option value="pay_on_gate">Pay on gate</option>
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <label style={labelStyle}>Adult price (pence)
            <input name="adult_price_pence" type="number" style={inputStyle} />
          </label>
          <label style={labelStyle}>Concession price (pence)
            <input name="concession_price_pence" type="number" style={inputStyle} />
          </label>
        </div>
        <button type="submit" style={greenBtnStyle}>Save ticket info</button>
      </form>

      <form method="post" action={`/api/admin/imports/${batchId}/repairs`} style={{ marginTop: "0.5rem" }}>
        <input type="hidden" name="csrf" value={csrfToken} />
        <input type="hidden" name="_action" value="acknowledge_missing_ticket_info" />
        <input type="hidden" name="issue_key" value="missing_ticket_info" />
        <input type="hidden" name="row_id" value={rowId} />
        <button type="submit" style={{ ...smallBtn, color: "#6f7e7a", border: "1px solid #dce3e2" }}>
          Acknowledge (batch only)
        </button>
      </form>
    </div>
  );
}

function SkipForm({ rowId, batchId, csrfToken }: {
  rowId: number; batchId: number; csrfToken: string;
}) {
  return (
    <details style={{ display: "inline-block" }}>
      <summary style={{
        cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#a53a2d", padding: "0.25rem 0.5rem"
      }}>Skip</summary>
      <form method="post" action={`/api/admin/imports/${batchId}/repairs`} style={{
        marginTop: "0.25rem", padding: "0.5rem", background: "#fafbfb", borderRadius: "6px",
        border: "1px solid #dce3e2", display: "grid", gap: "0.5rem", maxWidth: "300px"
      }}>
        <input type="hidden" name="csrf" value={csrfToken} />
        <input type="hidden" name="_action" value="skip_row" />
        <input type="hidden" name="row_id" value={rowId} />
        <label style={labelStyle}>Reason
          <select name="reason" required style={inputStyle}>
            <option value="">Select...</option>
            <option value="duplicate">Duplicate</option>
            <option value="bad_source_row">Bad source row</option>
            <option value="not_relevant">Not relevant</option>
            <option value="needs_later_review">Needs later review</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label style={labelStyle}>Note
          <input name="note" style={inputStyle} />
        </label>
        <button type="submit" style={{ ...smallBtn, color: "#a53a2d", border: "1px solid #f0beb7" }}>Skip fixture</button>
      </form>
    </details>
  );
}

function RowEditForm({ rowId, batchId, csrfToken, row, competitions }: {
  rowId: number; batchId: number; csrfToken: string; row: ImportBatchRow;
  competitions: { code: string; name: string; kind: string }[];
}) {
  const isFriendly = row.competitionResolvedCode === "FRIENDLY" || (row.competitionRaw ?? "").toLowerCase().includes("friendly");
  const compDefault = (() => {
    if (row.competitionResolvedCode) return row.competitionResolvedCode;
    const match = competitions.find(
      (c) => c.code === row.competitionRaw || c.name === row.competitionRaw
    );
    return match?.code ?? "";
  })();
  return (
    <div style={{
      marginTop: "0.25rem", padding: "0.5rem", background: "#fafbfb", borderRadius: "6px",
      border: "1px solid #dce3e2"
    }}>
      <form method="post" action={`/api/admin/imports/${batchId}/repairs`} style={{ display: "grid", gap: "0.35rem" }}>
        <input type="hidden" name="csrf" value={csrfToken} />
        <input type="hidden" name="_action" value="edit_row" />
        <input type="hidden" name="row_id" value={rowId} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
          <label style={labelStyle}>Home
            <input name="homeParticipantRaw" defaultValue={row.homeParticipantRaw ?? ""} style={inputStyle} />
          </label>
          <label style={labelStyle}>Away
            <input name="awayParticipantRaw" defaultValue={row.awayParticipantRaw ?? ""} style={inputStyle} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
          <label style={labelStyle}>Competition
            <select name="competitionRaw" defaultValue={compDefault} style={inputStyle} id={`edit-comp-${rowId}`}>
              <option value="">-- Select --</option>
              {competitions.map((c) => (
                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>Venue
            <input name="venueRaw" defaultValue={row.venueRaw ?? ""} style={inputStyle} />
          </label>
        </div>
        <label style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input type="checkbox" name="isFriendly" value="1" defaultChecked={isFriendly} style={{ transform: "scale(1.2)" }} />
          This is a friendly (no formal competition)
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
          <label style={labelStyle}>Date
            <input name="kickoffDate" defaultValue={row.kickoffDate ?? ""} style={inputStyle} />
          </label>
          <label style={labelStyle}>Time
            <input name="kickoffTime" defaultValue={row.kickoffTime ?? ""} style={inputStyle} />
          </label>
        </div>
        <label style={labelStyle}>Ticket URL
          <input name="ticketUrl" defaultValue={row.ticketUrl ?? ""} style={inputStyle} />
        </label>
        <button type="submit" style={greenBtnStyle}>Save & revalidate</button>
      </form>
    </div>
  );
}

function BulkApplyForm({ batchId, csrfToken, applyableCount }: {
  batchId: number; csrfToken: string; applyableCount: number;
}) {
  return (
    <form method="post" action={`/api/admin/imports/${batchId}`} style={{
      border: "1px solid #147a4d", borderRadius: "8px",
      background: "#f0faf6", padding: "0.75rem 1rem"
    }}>
      <input type="hidden" name="csrf" value={csrfToken} />
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "13px", cursor: "pointer" }}>
          <input type="checkbox" name="confirm" value="1" required />
          Import all {applyableCount} ready fixtures
        </label>
        <button type="submit" style={{
          border: "1px solid #147a4d", borderRadius: "6px",
          background: "#147a4d", color: "#fff",
          padding: "0.4rem 1rem", fontSize: "13px", fontWeight: 700, cursor: "pointer"
        }}>Import all ready</button>
      </div>
    </form>
  );
}

function FinalizedRow({ row }: { row: ImportBatchRow; batchId?: number }) {
  const style = row.finalAction === "skip" ? sSkip : sImported;
  return (
    <div style={{
      border: `1px solid ${style.border}`, borderRadius: "6px",
      padding: "0.5rem 0.75rem", marginBottom: "0.25rem",
      fontSize: "13px", display: "flex", gap: "0.5rem", alignItems: "center",
      background: style.bg
    }}>
      <span style={{ fontWeight: 600 }}>{row.homeParticipantRaw ?? "?"} vs {row.awayParticipantRaw ?? "?"}</span>
      {row.kickoffDate && <span style={{ color: "#6f7e7a" }}>{row.kickoffDate}</span>}
      {row.finalFixtureId && <span style={{ color: style.fg }}>Fixture #{row.finalFixtureId}</span>}
      {row.finalAction === "skip" && (
        <span style={{ color: "#6f7e7a" }}>
          Skipped{row.finalAction ? "" : ""}
        </span>
      )}
    </div>
  );
}

function DuplicateRow({ row }: { row: ImportBatchRow }) {
  return (
    <div style={{
      border: "1px solid #dce3e2", borderRadius: "6px",
      padding: "0.5rem 0.75rem", fontSize: "13px",
      display: "flex", gap: "0.5rem", alignItems: "center",
      background: "#f5f7f7"
    }}>
      <span style={{ fontWeight: 600 }}>{row.homeParticipantRaw ?? "?"} vs {row.awayParticipantRaw ?? "?"}</span>
      {row.kickoffDate && <span style={{ color: "#6f7e7a" }}>{row.kickoffDate}</span>}
      {row.competitionRaw && <span style={{ color: "#6f7e7a" }}>{row.competitionRaw}</span>}
    </div>
  );
}

function DangerZone({ batchId, csrfToken }: { batchId: number; csrfToken: string }) {
  return (
    <section style={{
      border: "1px solid #e0b3a8", borderRadius: "8px",
      background: "#fdf6f5", padding: "1rem", marginTop: "1.5rem"
    }}>
      <p style={{ margin: "0 0 0.5rem", fontWeight: 600, fontSize: "14px", color: "#a53a2d" }}>
        Danger zone
      </p>
      <form method="post" action={`/api/admin/imports/${batchId}`} id="delete-batch-form">
        <input type="hidden" name="csrf" value={csrfToken} />
        <input type="hidden" name="_action" value="delete" />
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "14px", cursor: "pointer", marginBottom: "0.75rem" }}>
          <input type="checkbox" name="confirm" value="1" required />
          I understand this will permanently delete this batch.
        </label>
        <button type="submit" style={{
          border: "1px solid #c0392b", borderRadius: "7px",
          background: "#e74c3c", color: "#fff",
          padding: "0.5rem 1.25rem", fontSize: "14px", fontWeight: 700, cursor: "pointer"
        }}>
          Delete batch
        </button>
      </form>
    </section>
  );
}

/* ── Shared Styles ── */

const labelStyle: React.CSSProperties = {
  fontSize: "12px", fontWeight: 600, color: "#34413e", display: "grid", gap: "0.15rem"
};

const inputStyle: React.CSSProperties = {
  padding: "0.35rem 0.5rem", border: "1px solid #dce3e2", borderRadius: "4px",
  fontSize: "13px", background: "#fff"
};

const greenBtnStyle: React.CSSProperties = {
  justifySelf: "start", border: "1px solid #147a4d", borderRadius: "6px",
  background: "#147a4d", color: "#fff", padding: "0.35rem 0.9rem",
  fontSize: "13px", fontWeight: 700, cursor: "pointer"
};

const smallBtn: React.CSSProperties = {
  borderRadius: "6px", padding: "0.3rem 0.7rem",
  fontSize: "12px", fontWeight: 600, cursor: "pointer", background: "#fff"
};
