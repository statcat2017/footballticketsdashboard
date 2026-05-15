import type { AppDatabase } from "@/lib/db/adapter";

import { ADMIN_ACTOR } from "./auth.ts";

export type AdminAuditAction = "create" | "update" | "delete" | "login" | "logout" | "unlock" | "publish";

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

export async function writeAdminAuditLog(db: AppDatabase, input: AdminAuditInput): Promise<void> {
  await db.run(`
    INSERT INTO admin_audit_log (actor, action, entity_type, entity_id, before_json, after_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    input.actor ?? ADMIN_ACTOR,
    input.action,
    input.entityType,
    input.entityId === undefined || input.entityId === null ? null : String(input.entityId),
    serializeAuditValue(input.before),
    serializeAuditValue(input.after)
  ]);
}
