import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { getOrCreateSource, createImportBatchFromCsv } from "@/lib/import";
import { validateImportBatch } from "@/lib/import/validation";

export async function POST(request: Request) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const csrf = form.get("csrf");
  if (typeof csrf !== "string" || !(await verifyAdminCsrfToken(csrf))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const csvText = form.get("csv");
  if (typeof csvText !== "string" || csvText.trim().length === 0) {
    return NextResponse.redirect(
      new URL("/admin/imports/new?error=CSV text is required.", request.url),
      { status: 303 }
    );
  }

  const sourceName = form.get("source_name");
  const sourceNameStr = typeof sourceName === "string" && sourceName.trim().length > 0
    ? sourceName.trim()
    : "Manual CSV Paste";

  const seasonLabel = form.get("season_label");

  const db = await getDatabase();

  try {
    const source = await getOrCreateSource(db, {
      sourceType: "csv_paste",
      name: sourceNameStr,
    });

    const actor = session.actor ?? "admin";
    const result = await createImportBatchFromCsv(db, csvText, source.id, actor, {
      seasonLabel: typeof seasonLabel === "string" && seasonLabel.length > 0 ? seasonLabel : undefined,
    });

    await validateImportBatch(db, result.batchId);

    return NextResponse.redirect(
      new URL(`/admin/imports/${result.batchId}`, request.url),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/admin/imports/new?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
