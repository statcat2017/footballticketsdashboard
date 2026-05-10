import { NextResponse } from "next/server";
import { z } from "zod";

import { getDatabase } from "@/lib/db/client";
import { defaultDateRange, searchFixtures } from "@/lib/search/service";

const searchSchema = z.object({
  postcode: z.string().min(5),
  radiusMiles: z.coerce.number().positive().max(200).default(20),
  dateFrom: z.string(),
  dateTo: z.string()
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const defaults = defaultDateRange();
  const parsed = searchSchema.safeParse({
    ...body,
    radiusMiles: body?.radiusMiles ?? 20,
    dateFrom: body?.dateFrom ?? defaults.dateFrom,
    dateTo: body?.dateTo ?? defaults.dateTo
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid postcode, radius, and date range." },
      { status: 400 }
    );
  }

  try {
    const results = searchFixtures(getDatabase(), parsed.data);

    return NextResponse.json({
      results,
      meta: {
        dateFrom: parsed.data.dateFrom,
        dateTo: parsed.data.dateTo,
        radiusMiles: parsed.data.radiusMiles,
        usedHistoricalFallback: results.some((result) => result.isHistorical)
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed." },
      { status: 400 }
    );
  }
}
