import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { fetchPage, extractTables } from "@/lib/import";

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
    return NextResponse.json({ error: "URL is required." }, { status: 400 });
  }

  try {
    const fetchResult = await fetchPage(url);
    if ("error" in fetchResult) {
      return NextResponse.json({ error: fetchResult.error }, { status: 400 });
    }

    const tables = extractTables(fetchResult.html);

    return NextResponse.json({
      tables: tables.map((t) => ({
        tableIndex: t.tableIndex,
        caption: t.caption,
        headers: t.headers,
        rowCount: t.rowCount,
        sampleCells: t.sampleCells,
        score: t.score,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
