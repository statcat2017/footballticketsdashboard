import type { AppDatabase } from "../db/adapter.ts";
import type { ImportBatch, ImportBatchRow, FixtureSource } from "../import/types.ts";
import { getBatch, getBatchRowsByMatchResult, listBatches, listSources } from "../import/index.ts";

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
  seasons: SeasonOption[];
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

  const grouped = await getBatchRowsByMatchResult(db, batchId);
  const seasons = await getSeasons(db);

  return { batch, source, grouped, seasons };
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
