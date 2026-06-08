import { describe, expect, it } from "vitest";

import { writeAdminAuditLog } from "@/lib/admin/audit";
import { createAppDatabase } from "@/lib/db/client";

describe("admin audit log", () => {
  it("writes structured audit rows", async () => {
    const db = await createAppDatabase();

    await writeAdminAuditLog(db, {
      action: "update",
      entityType: "pyramid_club",
      entityId: 123,
      before: { name: "Old" },
      after: { name: "New" }
    });

    const row = await db.get<{
      actor: string;
      action: string;
      entity_type: string;
      entity_id: string;
      before_json: string;
      after_json: string;
    }>("SELECT actor, action, entity_type, entity_id, before_json, after_json FROM admin_audit_log");

    expect(row).toEqual({
      actor: "admin",
      action: "update",
      entity_type: "pyramid_club",
      entity_id: "123",
      before_json: JSON.stringify({ name: "Old" }),
      after_json: JSON.stringify({ name: "New" })
    });
  });
});
