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

export function buildAdminAuditLogWrite(input: AdminAuditInput): SqlWrite {
  const params: QueryParam[] = [
    input.actor ?? ADMIN_ACTOR,
    input.action,
    input.entityType,
    input.entityId === undefined || input.entityId === null ? null : String(input.entityId),
    serializeAuditValue(input.before),
    serializeAuditValue(input.after)
  ];

  return {
    sql: "INSERT INTO admin_audit_log (actor, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)",
    params
  };
}

export async function writeAdminAuditLog(db: AppDatabase, input: AdminAuditInput): Promise<void> {
  const stmt = buildAdminAuditLogWrite(input);
  await db.run(stmt.sql, stmt.params);
}
