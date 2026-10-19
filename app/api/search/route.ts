import { NextResponse } from "next/server";
import { z } from "zod";

import { getDatabase } from "@/lib/db/client";
import { getTravelProviderRuntimeConfig } from "@/lib/runtime-env";
import { isPostcodeFormatValid, PostcodeResolutionError } from "@/lib/postcode";
import { resolveSearchOrigin, searchFixtures } from "@/lib/search/service";
import { defaultDateRange } from "@/lib/date";
import { scheduleSearchTravelBackfill } from "@/lib/travel/backfill";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const searchSchema = z.object({
  postcode: z.string().trim().refine(isPostcodeFormatValid, "Enter a valid UK postcode."),
  radiusMiles: z.preprocess(
    (value) => {
      if (value === undefined || value === "") return undefined;
      if (value === "all" || value === null) return null;
      return Number(value);
    },
    z.union([z.literal(25), z.literal(50), z.literal(100), z.null()]).optional()
  ),
  allowApproximateOrigin: z.boolean().optional().default(false),
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
  const bodyRecord = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const defaults = defaultDateRange();
  const parsed = searchSchema.safeParse({
    ...bodyRecord,
    radiusMiles: bodyRecord.radiusMiles === undefined ? 25 : bodyRecord.radiusMiles,
    dateFrom: bodyRecord.dateFrom ?? defaults.dateFrom,
    dateTo: bodyRecord.dateTo ?? defaults.dateTo
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: validationErrorMessage(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const resolvedOrigin = await resolveSearchOrigin(parsed.data.postcode);
    if (resolvedOrigin.source === "fallback" && !parsed.data.allowApproximateOrigin) {
      throw new PostcodeResolutionError(
        `We could not verify ${resolvedOrigin.normalized}. Search from an approximate postcode-area origin instead?`,
        true
      );
    }

    const db = await getDatabase();
    const travelProviders = await getTravelProviderRuntimeConfig();
    const results = await searchFixtures(db, parsed.data, {
      travelProviders,
      resolvedOrigin,
      allowApproximateOrigin: parsed.data.allowApproximateOrigin
    });
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
        radiusMiles: parsed.data.radiusMiles === undefined ? 25 : parsed.data.radiusMiles,
        originSource: resolvedOrigin.source,
        approximateOrigin: resolvedOrigin.source === "fallback",
        usedHistoricalFallback: results.some((result) => result.isHistorical)
      }
    });
  } catch (error) {
    if (error instanceof PostcodeResolutionError) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        canUseApproximateOrigin: error.canUseApproximateOrigin
      }, { status: 422 });
    }

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
