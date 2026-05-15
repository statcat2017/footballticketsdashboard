import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { updateAdminClub } from "@/lib/admin/clubs";

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

  try {
    await updateAdminClub(clubId, {
      name: readString(form.get("name")),
      aliases: readNullableString(form.get("aliases")),
      status: readString(form.get("status")),
      source_url: readNullableString(form.get("source_url")),
      verified_at: readNullableString(form.get("verified_at"))
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
