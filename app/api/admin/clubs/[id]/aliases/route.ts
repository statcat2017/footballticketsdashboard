import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { addAlias, retireAlias, listAliasesForClub } from "@/lib/db/clubMapping";
import { writeAdminAuditLog } from "@/lib/admin/audit";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const clubId = Number(id);
  if (!Number.isInteger(clubId) || clubId <= 0) {
    return NextResponse.json({ error: "Invalid club ID." }, { status: 400 });
  }

  const db = await getDatabase();
  const aliases = await listAliasesForClub(db, clubId);
  return NextResponse.json({ aliases });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const clubId = Number(id);
  if (!Number.isInteger(clubId) || clubId <= 0) {
    return NextResponse.json({ error: "Invalid club ID." }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const csrf = form.get("csrf");
  if (typeof csrf !== "string" || !(await verifyAdminCsrfToken(csrf))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const action = form.get("action");

  if (action === "retire") {
    return handleRetire(request, clubId, form);
  }

  return handleAddAlias(request, clubId, form);
}

async function handleRetire(request: Request, clubId: number, form: FormData) {
  const aliasId = Number(form.get("alias_id"));
  if (!Number.isInteger(aliasId) || aliasId <= 0) {
    return NextResponse.json({ error: "Invalid alias ID." }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    await retireAlias(db, aliasId, clubId);

    await writeAdminAuditLog(db, {
      action: "update",
      entityType: "club_alias",
      entityId: aliasId,
      before: { aliasId, clubId },
      after: { aliasId, clubId, retired: true },
    });

    return NextResponse.redirect(new URL(`/admin/clubs/${clubId}`, request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/admin/clubs/${clubId}?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}

async function handleAddAlias(request: Request, clubId: number, form: FormData) {
  const alias = form.get("alias");
  if (typeof alias !== "string" || !alias.trim()) {
    return NextResponse.json({ error: "Alias is required." }, { status: 400 });
  }

  const competitionCode = readNullableString(form.get("competition_code"));
  const source = readString(form.get("source")) ?? "manual";

  try {
    const db = await getDatabase();
    const created = await addAlias(db, clubId, alias.trim(), { competitionCode: competitionCode ?? undefined, source });

    await writeAdminAuditLog(db, {
      action: "create",
      entityType: "club_alias",
      entityId: created.id,
      before: null,
      after: { clubId, alias: created.alias, competitionCode: created.competitionCode, source: created.source },
    });

    return NextResponse.redirect(new URL(`/admin/clubs/${clubId}`, request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/admin/clubs/${clubId}?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}

function readString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNullableString(value: FormDataEntryValue | null): string | null | undefined {
  if (value === null) return undefined;
  return typeof value === "string" && value.length > 0 ? value : null;
}
