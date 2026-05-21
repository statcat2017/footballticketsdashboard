import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { deleteSlot } from "@/lib/admin/movements";

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const slotId = Number(id);

  if (!Number.isInteger(slotId) || slotId <= 0) {
    return NextResponse.json({ error: "Invalid slot ID." }, { status: 400 });
  }

  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const csrf = body?.csrf;

  if (typeof csrf !== "string" || !(await verifyAdminCsrfToken(csrf))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const db = await getDatabase();

  try {
    await deleteSlot(db, slotId, session.actor);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
