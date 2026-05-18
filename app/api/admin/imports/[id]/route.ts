import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { getDatabase } from "@/lib/db/client";
import { getBatchDetail } from "@/lib/admin/imports";

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

  const confirm = form.get("confirm");
  if (confirm !== "1") {
    return NextResponse.redirect(
      new URL(`/admin/imports/${batchId}?error=Please confirm the apply action.`, request.url),
      { status: 303 }
    );
  }

  const db = await getDatabase();
  const { applyBatchRows } = await import("@/lib/import/apply");

  try {
    const result = await applyBatchRows(db, batchId, session.actor ?? "admin");

    const params = new URLSearchParams();
    params.set("inserted", String(result.inserted));
    params.set("updated", String(result.updated));
    params.set("skipped", String(result.skipped));

    return NextResponse.redirect(
      new URL(`/admin/imports/${batchId}?${params.toString()}`, request.url),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/admin/imports/${batchId}?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
