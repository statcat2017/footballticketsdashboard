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

  // Batch standard rows (non-one-off with resolved IDs) into a single query
  const standardRows: ImportBatchRow[] = [];
  const otherRows: ImportBatchRow[] = [];

  for (const row of rows) {
    if (!row.homeIsOneOff && !row.awayIsOneOff && row.homeParticipantResolvedId && row.awayParticipantResolvedId && row.competitionResolvedCode) {
      standardRows.push(row);
    } else {
      otherRows.push(row);
    }
  }

  if (standardRows.length > 0) {
    const whereClauses: string[] = [];
    const params: (string | number | null)[] = [];

    for (const row of standardRows) {
      whereClauses.push(`(home_club_id = ? AND away_club_id = ? AND competition_code = ? AND season_label = ? AND fixture_date = ?)`);
      params.push(row.homeParticipantResolvedId, row.awayParticipantResolvedId, row.competitionResolvedCode, resolvedSeasonLabel, row.kickoffDate);
    }

    const fixtures = await db.all<Record<string, unknown>>(
      `SELECT id, home_club_id, away_club_id, competition_code, season_label,
              fixture_date, venue_id, kickoff_time, kickoff_time_status, status,
              home_one_off, away_one_off, home_one_off_name, away_one_off_name,
              source_url, ftpo.source_url AS ticket_url,
              ftpo.adult_price_pence, ftpo.concession_price_pence
       FROM fixtures
       LEFT JOIN fixture_ticket_price_overrides ftpo ON ftpo.fixture_id = fixtures.id
       WHERE ${whereClauses.join(" OR ")}`,
      params
    );

    for (const row of standardRows) {
      const match = fixtures.find((f) =>
        f.home_club_id === row.homeParticipantResolvedId &&
        f.away_club_id === row.awayParticipantResolvedId &&
        f.competition_code === row.competitionResolvedCode &&
        f.season_label === resolvedSeasonLabel &&
        f.fixture_date === row.kickoffDate
      );
      if (match) {
        const before: Record<string, unknown> = {};
        const fields = ["competition_code", "venue_id", "fixture_date", "kickoff_time", "kickoff_time_status", "status", "home_one_off", "away_one_off", "home_one_off_name", "away_one_off_name", "source_url", "ticket_url", "adult_price_pence", "concession_price_pence"];
        for (const f of fields) {
          if (f in match) before[f] = match[f];
        }
        previews.set(row.id, { fixtureId: match.id as number, before });
      }
    }
  }

  for (const row of otherRows) {
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

  return { batch, source, grouped: activeGrouped, activeGrouped, finalizedRows, seasons };
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
