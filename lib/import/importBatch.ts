import type { AppDatabase } from "../db/adapter.ts";
import type {
  ImportBatch,
  ImportBatchInput,
  ImportBatchRow,
  ImportBatchRowInput,
  ApprovalStatus,
  ParseStatus,
  BatchRowOutcomeUpdate,
} from "./types.ts";

function mapBatchRow(row: Record<string, unknown>): ImportBatch {
  return {
    id: row.id as number,
    sourceId: row.source_id as number,
    adapterType: row.adapter_type as ImportBatch["adapterType"],
    seasonLabel: (row.season_label as string) ?? null,
    actor: row.actor as string,
    rawPayload: (row.raw_payload as string) ?? null,
    rawPayloadSizeBytes: (row.raw_payload_size_bytes as number) ?? null,
    parseStatus: row.parse_status as ParseStatus,
    approvalStatus: row.approval_status as ApprovalStatus,
    rowCountTotal: row.row_count_total as number,
    rowCountApproved: row.row_count_approved as number,
    rowCountFailed: row.row_count_failed as number,
    parseErrorsJson: (row.parse_errors_json as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapRowRecord(row: Record<string, unknown>): ImportBatchRow {
  return {
    id: row.id as number,
    batchId: row.batch_id as number,
    rowIndex: row.row_index as number,
    homeParticipantRaw: (row.home_participant_raw as string) ?? null,
    awayParticipantRaw: (row.away_participant_raw as string) ?? null,
    homeParticipantResolvedId: (row.home_participant_resolved_id as number) ?? null,
    awayParticipantResolvedId: (row.away_participant_resolved_id as number) ?? null,
    homeIsOneOff: (row.home_is_one_off as number) === 1,
    awayIsOneOff: (row.away_is_one_off as number) === 1,
    competitionRaw: (row.competition_raw as string) ?? null,
    competitionResolvedCode: (row.competition_resolved_code as string) ?? null,
    venueRaw: (row.venue_raw as string) ?? null,
    venueResolvedId: (row.venue_resolved_id as number) ?? null,
    kickoffDate: (row.kickoff_date as string) ?? null,
    kickoffTime: (row.kickoff_time as string) ?? null,
    status: (row.status as ImportBatchRow["status"]) ?? null,
    ticketUrl: (row.ticket_url as string) ?? null,
    adultPricePence: (row.adult_price_pence as number) ?? null,
    concessionPricePence: (row.concession_price_pence as number) ?? null,
    sourceUrl: (row.source_url as string) ?? null,
    evidenceJson: (row.evidence_json as string) ?? null,
    confidence: row.confidence as ImportBatchRow["confidence"],
    matchResult: (row.match_result as ImportBatchRow["matchResult"]) ?? null,
    warningsJson: (row.warnings_json as string) ?? null,
    finalAction: (row.final_action as ImportBatchRow["finalAction"]) ?? null,
    finalFixtureId: (row.final_fixture_id as number) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function createBatch(db: AppDatabase, input: ImportBatchInput): Promise<ImportBatch> {
  const payloadSize = input.rawPayload ? new TextEncoder().encode(input.rawPayload).length : null;

  const result = await db.run(
    `INSERT INTO import_batches (source_id, adapter_type, season_label, actor, raw_payload, raw_payload_size_bytes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.sourceId,
      input.adapterType,
      input.seasonLabel ?? null,
      input.actor,
      input.rawPayload ?? null,
      payloadSize,
    ]
  );

  const row = await db.get<Record<string, unknown>>(
    `SELECT * FROM import_batches WHERE id = ?`,
    [result.lastInsertRowid ?? 0]
  );

  if (!row) {
    throw new Error("Failed to retrieve created import batch.");
  }

  return mapBatchRow(row);
}

export async function getBatch(db: AppDatabase, id: number): Promise<ImportBatch | undefined> {
  const row = await db.get<Record<string, unknown>>(
    `SELECT * FROM import_batches WHERE id = ?`,
    [id]
  );
  return row ? mapBatchRow(row) : undefined;
}

export async function listBatches(db: AppDatabase, options?: { sourceId?: number; limit?: number }): Promise<ImportBatch[]> {
  let sql = `SELECT * FROM import_batches`;
  const params: (string | number)[] = [];

  if (options?.sourceId !== undefined) {
    sql += ` WHERE source_id = ?`;
    params.push(options.sourceId);
  }

  sql += ` ORDER BY created_at DESC`;

  if (options?.limit !== undefined) {
    sql += ` LIMIT ?`;
    params.push(options.limit);
  }

  const rows = await db.all<Record<string, unknown>>(sql, params);
  return rows.map(mapBatchRow);
}

export async function updateBatchStatus(
  db: AppDatabase,
  id: number,
  status: { parseStatus?: ParseStatus; approvalStatus?: ApprovalStatus }
): Promise<ImportBatch> {
  const fields: string[] = [];
  const params: (string | number)[] = [];

  if (status.parseStatus !== undefined) {
    fields.push("parse_status = ?");
    params.push(status.parseStatus);
  }
  if (status.approvalStatus !== undefined) {
    fields.push("approval_status = ?");
    params.push(status.approvalStatus);
  }

  if (fields.length === 0) {
    const existing = await getBatch(db, id);
    if (!existing) {
      throw new Error(`Import batch ${id} not found.`);
    }
    return existing;
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");
  params.push(id);

  await db.run(
    `UPDATE import_batches SET ${fields.join(", ")} WHERE id = ?`,
    params
  );

  const updated = await getBatch(db, id);
  if (!updated) {
    throw new Error(`Import batch ${id} not found after update.`);
  }
  return updated;
}

export interface BatchCountUpdate {
  rowCountTotal?: number;
  rowCountApproved?: number;
  rowCountFailed?: number;
  parseErrorsJson?: string | null;
}

export async function updateBatchCounts(
  db: AppDatabase,
  id: number,
  counts: BatchCountUpdate
): Promise<void> {
  const fields: string[] = ["updated_at = CURRENT_TIMESTAMP"];
  const params: (string | number | null)[] = [];

  if (counts.rowCountTotal !== undefined) {
    fields.push("row_count_total = ?");
    params.push(counts.rowCountTotal);
  }
  if (counts.rowCountApproved !== undefined) {
    fields.push("row_count_approved = ?");
    params.push(counts.rowCountApproved);
  }
  if (counts.rowCountFailed !== undefined) {
    fields.push("row_count_failed = ?");
    params.push(counts.rowCountFailed);
  }
  if (counts.parseErrorsJson !== undefined) {
    fields.push("parse_errors_json = ?");
    params.push(counts.parseErrorsJson);
  }

  params.push(id);

  await db.run(
    `UPDATE import_batches SET ${fields.join(", ")} WHERE id = ?`,
    params
  );
}

export async function addBatchRows(
  db: AppDatabase,
  batchId: number,
  rows: ImportBatchRowInput[]
): Promise<void> {
  if (rows.length === 0) return;

  const statements = rows.map((r) => ({
    sql: `INSERT INTO import_batch_rows (
      batch_id, row_index, home_participant_raw, away_participant_raw,
      home_is_one_off, away_is_one_off, competition_raw, venue_raw,
      kickoff_date, kickoff_time, status, ticket_url,
      adult_price_pence, concession_price_pence, source_url,
      evidence_json, confidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      batchId,
      r.rowIndex,
      r.row.homeParticipantRaw,
      r.row.awayParticipantRaw,
      r.row.homeIsOneOff ? 1 : 0,
      r.row.awayIsOneOff ? 1 : 0,
      r.row.competitionRaw ?? null,
      r.row.venueRaw ?? null,
      r.row.kickoffDate ?? null,
      r.row.kickoffTime ?? null,
      r.row.status ?? null,
      r.row.ticketUrl ?? null,
      r.row.adultPricePence ?? null,
      r.row.concessionPricePence ?? null,
      r.row.sourceUrl ?? null,
      r.row.evidence ? JSON.stringify(r.row.evidence) : null,
      r.row.confidence ?? "unknown",
    ],
  }));

  await db.writeBatch(statements);
}

export async function getBatchRows(db: AppDatabase, batchId: number): Promise<ImportBatchRow[]> {
  const rows = await db.all<Record<string, unknown>>(
    `SELECT * FROM import_batch_rows WHERE batch_id = ? ORDER BY row_index ASC`,
    [batchId]
  );
  return rows.map(mapRowRecord);
}

export async function getBatchRow(db: AppDatabase, id: number): Promise<ImportBatchRow | undefined> {
  const row = await db.get<Record<string, unknown>>(
    `SELECT * FROM import_batch_rows WHERE id = ?`,
    [id]
  );
  return row ? mapRowRecord(row) : undefined;
}

export async function updateBatchRow(
  db: AppDatabase,
  id: number,
  updates: Partial<{
    homeParticipantResolvedId: number | null;
    awayParticipantResolvedId: number | null;
    homeIsOneOff: boolean;
    awayIsOneOff: boolean;
    competitionResolvedCode: string | null;
    venueResolvedId: number | null;
    kickoffDate: string | null;
    kickoffTime: string | null;
    status: ImportBatchRow["status"];
    matchResult: ImportBatchRow["matchResult"];
    warningsJson: string | null;
    finalAction: ImportBatchRow["finalAction"];
    finalFixtureId: number | null;
  }>
): Promise<ImportBatchRow> {
  const fields: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.homeParticipantResolvedId !== undefined) {
    fields.push("home_participant_resolved_id = ?");
    params.push(updates.homeParticipantResolvedId);
  }
  if (updates.awayParticipantResolvedId !== undefined) {
    fields.push("away_participant_resolved_id = ?");
    params.push(updates.awayParticipantResolvedId);
  }
  if (updates.homeIsOneOff !== undefined) {
    fields.push("home_is_one_off = ?");
    params.push(updates.homeIsOneOff ? 1 : 0);
  }
  if (updates.awayIsOneOff !== undefined) {
    fields.push("away_is_one_off = ?");
    params.push(updates.awayIsOneOff ? 1 : 0);
  }
  if (updates.homeIsOneOff !== undefined) {
    fields.push("home_is_one_off = ?");
    params.push(updates.homeIsOneOff ? 1 : 0);
  }
  if (updates.competitionResolvedCode !== undefined) {
    fields.push("competition_resolved_code = ?");
    params.push(updates.competitionResolvedCode);
  }
  if (updates.venueResolvedId !== undefined) {
    fields.push("venue_resolved_id = ?");
    params.push(updates.venueResolvedId);
  }
  if (updates.kickoffDate !== undefined) {
    fields.push("kickoff_date = ?");
    params.push(updates.kickoffDate);
  }
  if (updates.kickoffTime !== undefined) {
    fields.push("kickoff_time = ?");
    params.push(updates.kickoffTime);
  }
  if (updates.status !== undefined) {
    fields.push("status = ?");
    params.push(updates.status);
  }
  if (updates.matchResult !== undefined) {
    fields.push("match_result = ?");
    params.push(updates.matchResult);
  }
  if (updates.warningsJson !== undefined) {
    fields.push("warnings_json = ?");
    params.push(updates.warningsJson);
  }
  if (updates.finalAction !== undefined) {
    fields.push("final_action = ?");
    params.push(updates.finalAction);
  }
  if (updates.finalFixtureId !== undefined) {
    fields.push("final_fixture_id = ?");
    params.push(updates.finalFixtureId);
  }

  if (fields.length === 0) {
    const existing = await getBatchRow(db, id);
    if (!existing) {
      throw new Error(`Import batch row ${id} not found.`);
    }
    return existing;
  }

  params.push(id);

  await db.run(
    `UPDATE import_batch_rows SET ${fields.join(", ")} WHERE id = ?`,
    params
  );

  const updated = await getBatchRow(db, id);
  if (!updated) {
    throw new Error(`Import batch row ${id} not found after update.`);
  }
  return updated;
}

export async function getBatchRowsByMatchResult(
  db: AppDatabase,
  batchId: number
): Promise<Record<string, ImportBatchRow[]>> {
  const rows = await getBatchRows(db, batchId);
  const grouped: Record<string, ImportBatchRow[]> = {
    insert: [],
    update: [],
    skip: [],
    blocked: [],
    pending: [],
  };

  for (const row of rows) {
    const key = row.matchResult ?? "pending";
    grouped[key].push(row);
  }

  return grouped;
}

export async function updateBatchRowOutcome(
  db: AppDatabase,
  rowId: number,
  outcome: BatchRowOutcomeUpdate
): Promise<ImportBatchRow> {
  return updateBatchRow(db, rowId, {
    matchResult: outcome.matchResult,
    warningsJson: outcome.warnings !== undefined
      ? JSON.stringify(outcome.warnings)
      : undefined,
    finalAction: outcome.finalAction,
    finalFixtureId: outcome.finalFixtureId,
    homeParticipantResolvedId: outcome.homeParticipantResolvedId,
    awayParticipantResolvedId: outcome.awayParticipantResolvedId,
    homeIsOneOff: outcome.homeIsOneOff,
    awayIsOneOff: outcome.awayIsOneOff,
    competitionResolvedCode: outcome.competitionResolvedCode,
    venueResolvedId: outcome.venueResolvedId,
    kickoffDate: outcome.kickoffDate,
    kickoffTime: outcome.kickoffTime,
    status: outcome.status,
  });
}
