import { NextResponse } from "next/server";
import { z } from "zod";

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
