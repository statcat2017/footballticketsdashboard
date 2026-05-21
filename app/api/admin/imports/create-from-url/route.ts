import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { createImportBatchFromHtmlUrl } from "@/lib/import";
import { validateImportBatch } from "@/lib/import/validation";
import { getTrustedImportDomains } from "@/lib/admin/imports";
import { adminRedirect } from "@/lib/admin/redirect";

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
    return adminRedirect(request, "/admin/imports/new?error=URL is required.");
  }

  const selectedTablesRaw = form.get("selected_tables");
  let selectedTableIndices: number[] | undefined;
  if (typeof selectedTablesRaw === "string" && selectedTablesRaw.length > 0) {
    selectedTableIndices = selectedTablesRaw.split(",").map(Number).filter((n) => !isNaN(n));
  }

  if (selectedTableIndices !== undefined && selectedTableIndices.length === 0) {
    return adminRedirect(request, "/admin/imports/new?error=Select at least one table to import.");
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
      return adminRedirect(request, `/admin/imports/new?error=${errorParam}`);
    }

    await validateImportBatch(db, result.batchId);

    return adminRedirect(request, `/admin/imports/${result.batchId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return adminRedirect(request, `/admin/imports/new?error=${encodeURIComponent(message)}`);
  }
}
