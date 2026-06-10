import type { AppDatabase } from "@/lib/db/adapter";
import type { QueryParam, SqlWrite } from "@/lib/db/adapter";

import { ADMIN_ACTOR } from "./auth.ts";

export type AdminAuditAction = "create" | "update" | "delete" | "login" | "logout" | "unlock" | "publish" | "movement_slot_fill" | "movement_slot_unfill" | "movement_slot_delete" | "movement_slot_apply";

export interface AdminAuditInput {
  actor?: string;
  action: AdminAuditAction;
  entityType: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
}

function serializeAuditValue(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  return JSON.stringify(value);
}

export const LAST_INSERT_ROWID = "@last_insert_rowid";

export function buildAdminAuditLogWrite(input: AdminAuditInput): SqlWrite {
  const useLastRowId = input.entityId === LAST_INSERT_ROWID;

  const params: QueryParam[] = [
    input.actor ?? ADMIN_ACTOR,
    input.action,
    input.entityType,
    serializeAuditValue(input.before),
    serializeAuditValue(input.after)
  ];

  const sql = useLastRowId
    ? "INSERT INTO admin_audit_log (actor, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, last_insert_rowid(), ?, ?)"
    : "INSERT INTO admin_audit_log (actor, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)";

  if (!useLastRowId) {
    params.splice(3, 0, input.entityId === undefined || input.entityId === null ? null : String(input.entityId));
  }

  return { sql, params };
}

export async function writeAdminAuditLog(db: AppDatabase, input: AdminAuditInput): Promise<void> {
  const stmt = buildAdminAuditLogWrite(input);
  await db.run(stmt.sql, stmt.params);
}
