import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { getDatabase } from "@/lib/db/client";
import { getImportPreviewCounts, getImportUpdatePreviews, type ImportUpdatePreview } from "@/lib/admin/imports";
import type { ImportBatch, ImportBatchRow, WarningIssue } from "@/lib/import/types";
import { getBatch, getBatchRows, listSources } from "@/lib/import/index";
import { findImportFixtureCandidateMatchesForRows, type FixtureCandidateMatch } from "@/lib/import/fixtureIdentity";
import { RevalidateAllButton } from "./_components/RevalidateAllButton";
import { BulkApplyForm } from "./_components/BulkApplyForm";
import { DeleteBatchForm } from "./_components/DeleteBatchForm";
import { ImportButton } from "./_components/ImportButton";
import { SkipForm } from "./_components/SkipForm";
import { RowEditForm } from "./_components/RowEditForm";
import { CreateCompetitionForm } from "./_components/CreateCompetitionForm";
import { MatchClubForm } from "./_components/MatchClubForm";
import { CreateClubForm } from "./_components/CreateClubForm";
import { VenueRepairForm } from "./_components/VenueRepairForm";
import { TicketRepairForm } from "./_components/TicketRepairForm";

export const dynamic = "force-dynamic";

const sInsert = { bg: "#e8f4f1", fg: "#0e5737", border: "#b8d9cf", label: "Insert" };
const sBlocked = { bg: "#fde9e5", fg: "#a53a2d", border: "#f0beb7", label: "Blocked" };
const sSkip = { bg: "#f5f6f6", fg: "#6f7e7a", border: "#dce3e2", label: "Skip" };
const sPending = { bg: "#fdf3e9", fg: "#8a5a00", border: "#f0d5b7", label: "Pending" };
const sImported = { bg: "#e8f4f1", fg: "#0e5737", border: "#b8d9cf", label: "Imported" };

export default async function AdminImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPageSession();
  const { id } = await params;

  const batchId = parseInt(id, 10);
  if (isNaN(batchId)) return <div>Invalid batch ID.</div>;

  const db = await getDatabase();

  // Lightweight: fetch batch metadata only
  const batch = await getBatch(db, batchId);
  if (!batch) {
    return (
      <main style={{ maxWidth: "48rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
        <p>Batch not found.</p>
        <Link href="/admin/imports">Back to imports</Link>
      </main>
    );
  }

  const allSources = await listSources(db);
  const source = allSources.find((s) => s.id === batch.sourceId);

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

      <div style={{ marginBottom: "1rem" }}>
        <RevalidateAllButton batchId={batchId} />
      </div>

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

      <Suspense fallback={<CardSkeleton />}>
        <FixtureCardSection db={db} batchId={batchId} batch={batch} />
      </Suspense>
    </main>
  );
}

function CardSkeleton() {
  return (
    <>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ height: "28px", width: "80px", background: "#e8eceb", borderRadius: "999px" }} />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ height: "120px", background: "#f5f6f6", borderRadius: "8px", marginBottom: "0.75rem" }} />
      ))}
    </>
  );
}

async function FixtureCardSection({
  db, batchId, batch
}: {
  db: import("@/lib/db/adapter").AppDatabase;
  batchId: number;
  batch: ImportBatch;
}) {
  const allRows = await getBatchRows(db, batchId);
  const activeRows = allRows.filter((r) => !r.finalAction);
  const finalizedRows = allRows.filter((r) => r.finalAction);
  const activeGrouped: Record<string, ImportBatchRow[]> = {};
  for (const r of activeRows) {
    const key = r.matchResult ?? "pending";
    if (!activeGrouped[key]) activeGrouped[key] = [];
    activeGrouped[key].push(r);
  }

  const counts = getImportPreviewCounts(activeGrouped);
  const finalizedInsert = finalizedRows.filter((r) => r.finalAction === "insert" || r.finalAction === "update");
  const finalizedSkip = finalizedRows.filter((r) => r.finalAction === "skip");
  const hasBeenApplied = batch.approvalStatus === "approved" || batch.approvalStatus === "partially_approved";

  const insertRows = activeGrouped.insert ?? [];
  const updateRows = activeGrouped.update ?? [];
  const blockedRows = activeGrouped.blocked ?? [];
  const pendingRows = activeGrouped.pending ?? [];
  const duplicateFixtureRows = activeGrouped.duplicate_existing_fixture ?? [];
  const duplicatePendingRows = activeGrouped.duplicate_pending_batch ?? [];
  const duplicateSameBatchRows = activeGrouped.duplicate_same_batch ?? [];
  const applyableCount = insertRows.length + updateRows.length;
  const updatePreviews = await getImportUpdatePreviews(db, updateRows, batch.seasonLabel);

  const clubs = await db.all<{ id: number; name: string }>(`SELECT id, name FROM clubs ORDER BY name`);
  const venues = await db.all<{ id: number; name: string; postcode: string }>(`SELECT id, name, postcode FROM venues ORDER BY name`);
  const competitions = await db.all<{ code: string; name: string; kind: string }>(
    `SELECT code, name, kind FROM competitions ORDER BY name`
  );
  const clubById = new Map(clubs.map(c => [c.id, c]));
  const venueById = new Map(venues.map(v => [v.id, v]));
  const venueByName = new Map(venues.map(v => [v.name.toLowerCase(), v]));
  const compByCode = new Map(competitions.map(c => [c.code, c]));

  const allActiveRows = [...blockedRows, ...insertRows, ...updateRows, ...pendingRows];
  const warningsByRow = new Map<number, WarningIssue[]>();
  for (const row of allActiveRows) {
    warningsByRow.set(row.id, parseWarnings(row.warningsJson));
  }

  const possibleMatches = await findImportFixtureCandidateMatchesForRows(db, blockedRows, batch.seasonLabel, 5);

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
    <>
      <SummaryBar counts={counts} finalizedInsert={finalizedInsert.length} finalizedSkip={finalizedSkip.length} />

      {blockedRows.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem", color: "#a53a2d" }}>
            Needs resolution ({blockedRows.length})
          </h2>
          {blockedRows.map((row) => (
            <FixtureCard
              key={row.id}
              row={row}
              batchId={batchId}
              mode="blocked"
              clubById={clubById}
              venueById={venueById}
              venueByName={venueByName}
              compByCode={compByCode}
              clubs={clubs}
              venues={venues}
              competitions={competitions}
              warnings={warningsByRow.get(row.id) ?? []}
              possibleMatches={possibleMatches.get(row.id) ?? []}
              acknowledgedKeys={acknowledgedKeys}
              acknowledgedRowKeys={acknowledgedRowKeys.get(row.id) ?? new Set()}
            />
          ))}
        </section>
      )}

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
                  batchId={batchId}
                  mode="ready"
                  clubById={clubById}
                  venueById={venueById}
                  venueByName={venueByName}
                  compByCode={compByCode}
                  clubs={clubs}
                  venues={venues}
                  competitions={competitions}
                  warnings={warningsByRow.get(row.id) ?? []}
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
                  batchId={batchId}
                  mode="ready"
                  clubById={clubById}
                  venueById={venueById}
                  venueByName={venueByName}
                  compByCode={compByCode}
                  clubs={clubs}
                  venues={venues}
                  competitions={competitions}
                  warnings={warningsByRow.get(row.id) ?? []}
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
              <BulkApplyForm batchId={batchId} applyableCount={applyableCount} />
            </div>
          )}
        </section>
      )}

      {pendingRows.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem", color: "#8a5a00" }}>
            Pending ({pendingRows.length})
          </h2>
          {pendingRows.map((row) => (
            <FixtureCard
              key={row.id}
              row={row}
              batchId={batchId}
              mode="pending"
              clubById={clubById}
              venueById={venueById}
              venueByName={venueByName}
              compByCode={compByCode}
              clubs={clubs}
              venues={venues}
              competitions={competitions}
              warnings={warningsByRow.get(row.id) ?? []}
              possibleMatches={possibleMatches.get(row.id) ?? []}
              acknowledgedKeys={acknowledgedKeys}
              acknowledgedRowKeys={acknowledgedRowKeys.get(row.id) ?? new Set()}
            />
          ))}
        </section>
      )}

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

      {!hasBeenApplied && (
        <DeleteBatchForm batchId={batchId} />
      )}
    </>
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

function FixtureCard({ row, batchId, mode, clubById, venueById, venueByName, compByCode, clubs, venues, competitions, warnings, possibleMatches, acknowledgedKeys, acknowledgedRowKeys, updatePreview }: {
  row: ImportBatchRow;
  batchId: number;
  mode: "blocked" | "ready" | "pending";
  clubById: Map<number, { id: number; name: string }>;
  venueById: Map<number, { id: number; name: string; postcode: string }>;
  venueByName: Map<string, { id: number; name: string; postcode: string }>;
  compByCode: Map<string, { code: string; name: string; kind: string }>;
  clubs: { id: number; name: string }[];
  venues: { id: number; name: string; postcode: string }[];
  competitions: { code: string; name: string; kind: string }[];
  warnings: WarningIssue[];
  possibleMatches: FixtureCandidateMatch[];
  acknowledgedKeys: Set<string>;
  acknowledgedRowKeys: Set<string>;
  updatePreview?: ImportUpdatePreview;
}) {
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

  const homeClub = row.homeParticipantResolvedId ? clubById.get(row.homeParticipantResolvedId) : undefined;
  const awayClub = row.awayParticipantResolvedId ? clubById.get(row.awayParticipantResolvedId) : undefined;
  const resolvedVenue = row.venueResolvedId ? venueById.get(row.venueResolvedId) : undefined;

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
    const comp = compByCode.get(row.competitionResolvedCode);
    checklist.push({ field: "Competition", status: "resolved", value: comp ? comp.name : row.competitionResolvedCode, message: "" });
  } else if (blockerMap.has("unknown_competition") || blockerMap.has("missing_competition")) {
    const blocker = blockerMap.get("unknown_competition") ?? blockerMap.get("missing_competition")!;
    checklist.push({ field: "Competition", status: "blocked", value: row.competitionRaw ?? "?", message: blocker.message });
  } else {
    checklist.push({ field: "Competition", status: "missing", value: row.competitionRaw ?? "?", message: "" });
  }

  // Venue
  if (resolvedVenue) {
    const isDefaulted = row.venueRaw && !venueByName.has(row.venueRaw.toLowerCase());
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
  const updatePreviewRows = updatePreview ? buildUpdatePreviewRows(row, updatePreview, venueById) : [];

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
          <TicketRepairForm rowId={row.id} batchId={batchId}
            homeResolvedId={row.homeParticipantResolvedId} />
        </div>
      )}

      {/* Actions */}
      {mode === "ready" && (
        <div style={{
          padding: "0.5rem 1rem", borderTop: "1px solid #eef1f1",
          display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap"
        }}>
          <ImportButton batchId={batchId} rowId={row.id} />

          <SkipForm batchId={batchId} rowId={row.id} />

          <details style={{ display: "inline-block" }}>
            <summary style={{
              cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#6f7e7a", padding: "0.25rem 0.5rem"
            }}>Edit fields</summary>
            <RowEditForm batchId={batchId} rowId={row.id} row={row} competitions={competitions} />
          </details>
        </div>
      )}

      {mode === "blocked" && (
        <div style={{
          padding: "0.5rem 1rem", borderTop: "1px solid #eef1f1",
          display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap"
        }}>
          <SkipForm batchId={batchId} rowId={row.id} />

          <details style={{ display: "inline-block" }}>
            <summary style={{
              cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#6f7e7a", padding: "0.25rem 0.5rem"
            }}>Edit fields</summary>
            <RowEditForm batchId={batchId} rowId={row.id} row={row} competitions={competitions} />
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
  venueById: Map<number, { id: number; name: string; postcode: string }>,
): Array<{ field: string; current: string; proposed: string }> {
  const before = preview.before;
  const rows: Array<{ field: string; current: string; proposed: string }> = [];

  const venueName = (value: unknown) => {
    if (typeof value !== "number") return formatEmpty(value);
    return venueById.get(value)?.name ?? `Venue #${value}`;
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

function IssueRepair({ issue, rowId, batchId, homeResolvedId, competitionResolvedCode, clubs, venues, competitions }: {
  issue: WarningIssue;
  rowId: number;
  batchId: number;
  homeResolvedId: number | null;
  competitionResolvedCode: string | null;
  clubs: { id: number; name: string }[];
  venues: { id: number; name: string; postcode: string }[];
  competitions?: { code: string; name: string; kind: string }[];
}) {
  switch (issue.code) {
    case "unknown_competition":
      return (
        <div style={{ marginTop: "0.25rem" }}>
          <RowEditForm batchId={batchId} rowId={rowId} row={{ competitionRaw: issue.rawValue ?? "" } as ImportBatchRow} competitions={competitions ?? []} />
          <CreateCompetitionForm batchId={batchId} rawValue={issue.rawValue ?? ""} code={issue.rawValue?.replace(/[^a-z0-9]/gi, "_").toUpperCase() ?? ""} />
        </div>
      );
    case "unknown_club":
      return (
        <div>
          <MatchClubForm batchId={batchId} rowId={rowId} rawValue={issue.rawValue ?? ""}
            competitionCode={competitionResolvedCode} clubs={clubs} />
          <CreateClubForm batchId={batchId} rowId={rowId} rawValue={issue.rawValue ?? ""}
            venues={venues} />
        </div>
      );
    case "missing_primary_venue":
      return <VenueRepairForm batchId={batchId} rowId={rowId}
        clubId={homeResolvedId} venues={venues} />;
    default:
      return null;
  }
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


