import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { createImportBatchFromHtmlUrl } from "@/lib/import";
import { validateImportBatch } from "@/lib/import/validation";
import { getTrustedImportDomains } from "@/lib/admin/imports";

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

  const url = form.get("url");
  if (typeof url !== "string" || url.trim().length === 0) {
    return NextResponse.redirect(
      new URL("/admin/imports/new?error=URL is required.", request.url),
      { status: 303 }
    );
  }

  const selectedTablesRaw = form.get("selected_tables");
  let selectedTableIndices: number[] | undefined;
  if (typeof selectedTablesRaw === "string" && selectedTablesRaw.length > 0) {
    selectedTableIndices = selectedTablesRaw.split(",").map(Number).filter((n) => !isNaN(n));
  }

  if (selectedTableIndices !== undefined && selectedTableIndices.length === 0) {
    return NextResponse.redirect(
      new URL("/admin/imports/new?error=Select at least one table to import.", request.url),
      { status: 303 }
    );
  }

  const seasonLabel = form.get("season_label");

  const db = await getDatabase();

  try {
    const actor = session.actor ?? "admin";
    const result = await createImportBatchFromHtmlUrl(db, url, actor, {
      seasonLabel: typeof seasonLabel === "string" && seasonLabel.length > 0 ? seasonLabel : undefined,
      selectedTableIndices,
      trustedDomains: getTrustedImportDomains(),
    });

    if (result.batchId === 0 && result.errors.length > 0) {
      const errorParam = encodeURIComponent(result.errors.join("; "));
      return NextResponse.redirect(
        new URL(`/admin/imports/new?error=${errorParam}`, request.url),
        { status: 303 }
      );
    }

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
