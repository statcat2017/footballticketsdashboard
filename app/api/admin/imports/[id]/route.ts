import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { getDatabase } from "@/lib/db/client";
import { getBatchDetail } from "@/lib/admin/imports";
import { buildAdminAuditLogWrite } from "@/lib/admin/audit";
import { adminRedirect } from "@/lib/admin/redirect";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const batchId = parseInt(id, 10);
  if (isNaN(batchId)) {
    return NextResponse.json({ error: "Invalid batch ID." }, { status: 400 });
  }

  const db = await getDatabase();

  try {
    const detail = await getBatchDetail(db, batchId);

    if (!detail.batch) {
      return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    }

    const rows = Object.fromEntries(
      Object.entries(detail.grouped).map(([key, rows]) => [
        key,
        rows.map((r) => ({
          id: r.id,
          rowIndex: r.rowIndex,
          homeParticipantRaw: r.homeParticipantRaw,
          awayParticipantRaw: r.awayParticipantRaw,
          competitionRaw: r.competitionRaw,
          venueRaw: r.venueRaw,
          kickoffDate: r.kickoffDate,
          kickoffTime: r.kickoffTime,
          status: r.status,
          matchResult: r.matchResult,
          warningsJson: r.warningsJson,
          finalAction: r.finalAction,
          finalFixtureId: r.finalFixtureId,
          homeParticipantResolvedId: r.homeParticipantResolvedId,
          awayParticipantResolvedId: r.awayParticipantResolvedId,
          competitionResolvedCode: r.competitionResolvedCode,
          venueResolvedId: r.venueResolvedId,
          homeIsOneOff: r.homeIsOneOff,
          awayIsOneOff: r.awayIsOneOff,
          ticketUrl: r.ticketUrl,
          sourceUrl: r.sourceUrl,
        })),
      ])
    );

    return NextResponse.json({
      batch: {
        id: detail.batch.id,
        sourceId: detail.batch.sourceId,
        sourceName: detail.source?.name ?? `Source #${detail.batch.sourceId}`,
        adapterType: detail.batch.adapterType,
        seasonLabel: detail.batch.seasonLabel,
        actor: detail.batch.actor,
        parseStatus: detail.batch.parseStatus,
        approvalStatus: detail.batch.approvalStatus,
        rowCountTotal: detail.batch.rowCountTotal,
        rowCountApproved: detail.batch.rowCountApproved,
        rowCountFailed: detail.batch.rowCountFailed,
        parseErrorsJson: detail.batch.parseErrorsJson,
        createdAt: detail.batch.createdAt,
      },
      grouped: rows,
      seasons: detail.seasons,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const csrf = form.get("csrf");
  const { verifyAdminCsrfToken } = await import("@/lib/admin/csrf");
  if (typeof csrf !== "string" || !(await verifyAdminCsrfToken(csrf))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const { id } = await params;
  const batchId = parseInt(id, 10);
  if (isNaN(batchId)) {
    return NextResponse.json({ error: "Invalid batch ID." }, { status: 400 });
  }

  const action = form.get("_action");

  if (action === "delete") {
    const confirm = form.get("confirm");
    if (confirm !== "1") {
      return adminRedirect(request, `/admin/imports/${batchId}?error=Please confirm the delete action.`);
    }

    const db = await getDatabase();
    const { deleteBatch, getBatch } = await import("@/lib/import");

    try {
      const batch = await getBatch(db, batchId);
      await deleteBatch(db, batchId);
      await db.writeBatch([
        buildAdminAuditLogWrite({
          action: "delete",
          entityType: "import_batch",
          entityId: batchId,
          actor: session.actor ?? "admin",
          before: batch
            ? { sourceId: batch.sourceId, rowCountTotal: batch.rowCountTotal, approvalStatus: batch.approvalStatus }
            : undefined,
        }),
      ]);
      return adminRedirect(request, "/admin/imports?deleted=1");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return adminRedirect(request, `/admin/imports/${batchId}?error=${encodeURIComponent(message)}`);
    }
  }

  const confirm = form.get("confirm");
  if (confirm !== "1") {
    return adminRedirect(request, `/admin/imports/${batchId}?error=Please confirm the apply action.`);
  }

  const db = await getDatabase();
  const { applyBatchRows } = await import("@/lib/import/apply");

  try {
    const result = await applyBatchRows(db, batchId, session.actor ?? "admin");

    const params = new URLSearchParams();
    params.set("inserted", String(result.inserted));
    params.set("updated", String(result.updated));
    params.set("skipped", String(result.skipped));

    return adminRedirect(request, `/admin/imports/${batchId}?${params.toString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return adminRedirect(request, `/admin/imports/${batchId}?error=${encodeURIComponent(message)}`);
  }
}
