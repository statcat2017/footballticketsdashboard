import { NextResponse } from "next/server";

import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";

export async function GET(request: Request) {
  const session = await getAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ csrfToken: await createAdminCsrfToken() });
}
