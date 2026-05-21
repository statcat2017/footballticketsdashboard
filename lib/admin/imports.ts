import type { AppDatabase } from "../db/adapter.ts";
import type { ImportBatch, ImportBatchRow, FixtureSource, WarningIssue } from "../import/types.ts";
import { getBatch, getBatchRows, listBatches, listSources } from "../import/index.ts";
import { findImportFixtureMatch } from "../import/fixtureIdentity.ts";
import { getCurrentSeasonLabel } from "../import/shared.ts";

export interface ImportPreviewCounts {
  insert: number;
  update: number;
  blocked: number;
  skipped: number;
  pending: number;
}

export interface ImportUpdatePreview {
  fixtureId: number;
  before: Record<string, unknown>;
}

const skippedPreviewKeys = ["skip", "duplicate_existing_fixture", "duplicate_pending_batch", "duplicate_same_batch"];

export function getImportPreviewCounts(grouped: Record<string, ImportBatchRow[]>): ImportPreviewCounts {
  return {
    insert: (grouped.insert ?? []).length,
    update: (grouped.update ?? []).length,
    blocked: (grouped.blocked ?? []).length,
    skipped: skippedPreviewKeys.reduce((sum, key) => sum + (grouped[key] ?? []).length, 0),
    pending: (grouped.pending ?? []).length,
  };
}

export async function getImportUpdatePreviews(
  db: AppDatabase,
  rows: ImportBatchRow[],
  seasonLabel: string | null,
): Promise<Map<number, ImportUpdatePreview>> {
  const previews = new Map<number, ImportUpdatePreview>();
  if (rows.length === 0) return previews;

  const resolvedSeasonLabel = (seasonLabel ?? await getCurrentSeasonLabel(db)) ?? null;
  for (const row of rows) {
    const match = await findImportFixtureMatch(db, row, resolvedSeasonLabel);
    if (match.kind === "match") {
      previews.set(row.id, { fixtureId: match.id, before: match.before });
    }
  }
  return previews;
}

export interface SeasonOption {
  label: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
}

export interface BatchSummary {
  id: number;
  sourceName: string;
  adapterType: string;
  seasonLabel: string | null;
  actor: string;
  rowCountTotal: number;
  approvalStatus: string;
  parseStatus: string;
  createdAt: string;
}

export interface BatchDetail {
  batch: ImportBatch;
  source: FixtureSource | undefined;
  grouped: Record<string, ImportBatchRow[]>;
  activeGrouped: Record<string, ImportBatchRow[]>;
  finalizedRows: ImportBatchRow[];
  activeIssues: WarningIssue[];
  seasons: SeasonOption[];
}

export interface FixtureCardData {
  row: ImportBatchRow;
  issues: WarningIssue[];
  actions: Array<{
    id: number;
    action: string;
    reason: string | null;
    note: string | null;
    actor: string;
    createdAt: string;
  }>;
}

export async function getSeasons(db: AppDatabase): Promise<SeasonOption[]> {
  const rows = await db.all<{ label: string; starts_on: string; ends_on: string; is_current: number }>(
    `SELECT label, starts_on, ends_on, is_current FROM fixture_seasons ORDER BY starts_on DESC`
  );
  return rows.map((r) => ({
    label: r.label,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    isCurrent: r.is_current === 1,
  }));
}

export async function getRecentBatches(db: AppDatabase, limit = 20): Promise<BatchSummary[]> {
  const batches = await listBatches(db, { limit });
  const sources = await listSources(db);
  const sourceMap = new Map(sources.map((s) => [s.id, s.name]));

  return batches.map((b) => ({
    id: b.id,
    sourceName: sourceMap.get(b.sourceId) ?? `Source #${b.sourceId}`,
    adapterType: b.adapterType,
    seasonLabel: b.seasonLabel,
    actor: b.actor,
    rowCountTotal: b.rowCountTotal,
    approvalStatus: b.approvalStatus,
    parseStatus: b.parseStatus,
    createdAt: b.createdAt,
  }));
}

export async function getBatchDetail(db: AppDatabase, batchId: number): Promise<BatchDetail> {
  const batch = await getBatch(db, batchId);
  if (!batch) throw new Error(`Import batch ${batchId} not found.`);

  const allSources = await listSources(db);
  const source = allSources.find((s) => s.id === batch.sourceId);

  const allRows = await getBatchRows(db, batchId);
  const activeRows = allRows.filter((r) => !r.finalAction);
  const finalizedRows = allRows.filter((r) => r.finalAction);
  const activeGrouped: Record<string, ImportBatchRow[]> = { insert: [], update: [], skip: [], blocked: [], pending: [] };
  for (const r of activeRows) {
    const key = r.matchResult ?? "pending";
    if (!activeGrouped[key]) activeGrouped[key] = [];
    activeGrouped[key].push(r);
  }

  const seasons = await getSeasons(db);

  const { getActiveIssuesForBatch } = await import("../import/resolution.ts");
  const activeIssues = await getActiveIssuesForBatch(db, batchId);

  return { batch, source, grouped: activeGrouped, activeGrouped, finalizedRows, activeIssues, seasons };
}

export async function getFixtureCardsData(
  db: AppDatabase,
  batchId: number,
  rowIds?: number[],
): Promise<FixtureCardData[]> {
  const allRows = await getBatchRows(db, batchId);
  const rows = rowIds ? allRows.filter((r) => rowIds.includes(r.id)) : allRows;

  const issuesMap = new Map<number, WarningIssue[]>();
  for (const row of rows) {
    const rowIssues: WarningIssue[] = [];
    if (row.warningsJson) {
      try {
        const parsed = JSON.parse(row.warningsJson) as { issues?: WarningIssue[] };
        if (parsed.issues) rowIssues.push(...parsed.issues);
      } catch { /* skip */ }
    }
    issuesMap.set(row.id, rowIssues);
  }

  const actionRows = await db.all<{ id: number; row_id: number; action: string; reason: string | null; note: string | null; actor: string; created_at: string }>(
    `SELECT id, row_id, action, reason, note, actor, created_at FROM import_batch_row_actions WHERE batch_id = ? ORDER BY created_at DESC`,
    [batchId]
  );
  const actionsByRow = new Map<number, FixtureCardData["actions"]>();
  for (const a of actionRows) {
    const list = actionsByRow.get(a.row_id) ?? [];
    list.push({ id: a.id, action: a.action, reason: a.reason, note: a.note, actor: a.actor, createdAt: a.created_at });
    actionsByRow.set(a.row_id, list);
  }

  return rows.map((row) => ({
    row,
    issues: issuesMap.get(row.id) ?? [],
    actions: actionsByRow.get(row.id) ?? [],
  }));
}

export async function getSources(db: AppDatabase): Promise<FixtureSource[]> {
  return listSources(db);
}

export function getTrustedImportDomains(): string[] {
  return (process.env.IMPORT_TRUSTED_DOMAINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
