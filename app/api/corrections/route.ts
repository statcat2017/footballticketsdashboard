import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit } from "@/lib/rate-limit";
import { createCorrection } from "@/lib/corrections";
import { getDatabase } from "@/lib/db/client";

const correctionSchema = z.object({
  fixtureId: z.coerce.number().int().positive().optional(),
  clubName: z.string().max(120).optional(),
  email: z.string().email().optional().or(z.literal("")),
  priceText: z.string().min(2).max(500),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  message: z.string().max(1000).optional()
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(`corrections:${ip}`, 10, 3600_000);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = correctionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a correction with at least a price or pricing note." },
      { status: 400 }
    );
  }

  const correction = await createCorrection(await getDatabase(), {
    ...parsed.data,
    email: parsed.data.email || undefined,
    sourceUrl: parsed.data.sourceUrl || undefined
  });

  return NextResponse.json({ id: correction.id, status: "pending" }, { status: 201 });
}
