import { NextResponse } from "next/server";
import { z } from "zod";

import { getDatabase } from "@/lib/db/client";
import { getTravelProviderRuntimeConfig } from "@/lib/runtime-env";
import { searchFixtures } from "@/lib/search/service";
import { defaultDateRange } from "@/lib/date";
import { scheduleSearchTravelBackfill } from "@/lib/travel/backfill";

const postcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const searchSchema = z.object({
  postcode: z.string().trim().regex(postcodePattern, "Enter a valid UK postcode."),
  radiusMiles: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? undefined : Number(v)),
    z.number().positive().max(500).optional()
  ),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional()
}).superRefine((value, context) => {
  if (value.dateFrom && !isValidIsoDate(value.dateFrom)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dateFrom"],
      message: "Enter a valid start date in YYYY-MM-DD format."
    });
  }

  if (value.dateTo && !isValidIsoDate(value.dateTo)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dateTo"],
      message: "Enter a valid end date in YYYY-MM-DD format."
    });
  }

  if (value.dateFrom && value.dateTo && isValidIsoDate(value.dateFrom) && isValidIsoDate(value.dateTo) && value.dateFrom > value.dateTo) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dateTo"],
      message: "End date must be on or after the start date."
    });
  }
});

function validationErrorMessage(parsedError: z.ZodError): string {
  return parsedError.issues[0]?.message ?? "Enter a valid search request.";
}

function isClientSearchError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.startsWith("Enter a valid");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const defaults = defaultDateRange();
  const parsed = searchSchema.safeParse({
    ...body,
    dateFrom: body?.dateFrom ?? defaults.dateFrom,
    dateTo: body?.dateTo ?? defaults.dateTo
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: validationErrorMessage(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const db = await getDatabase();
    const travelProviders = await getTravelProviderRuntimeConfig();
    const results = await searchFixtures(db, parsed.data, { travelProviders });
    scheduleSearchTravelBackfill(db, {
      postcode: parsed.data.postcode,
      dateFrom: parsed.data.dateFrom ?? defaults.dateFrom,
      dateTo: parsed.data.dateTo ?? defaults.dateTo
    }, travelProviders);

    return NextResponse.json({
      results,
      meta: {
        dateFrom: parsed.data.dateFrom,
        dateTo: parsed.data.dateTo,
        radiusMiles: parsed.data.radiusMiles ?? null,
        usedHistoricalFallback: results.some((result) => result.isHistorical)
      }
    });
  } catch (error) {
    if (isClientSearchError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error("[search] error:", error instanceof Error ? error.stack || error.message : error);
    return NextResponse.json(
      { error: "Search failed." },
      { status: 500 }
    );
  }
}
