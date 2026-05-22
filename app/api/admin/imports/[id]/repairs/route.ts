import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin/auth";
import { verifyAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { buildAdminAuditLogWrite } from "@/lib/admin/audit";
import { adminUrl } from "@/lib/admin/redirect";
import { addAlias, normalizeName } from "@/lib/db/clubMapping";
import {
  createAdminVenue,
  assignAdminVenue,
  isValidDate,
  nextJuly1st,
} from "@/lib/admin/venues";
import {
  acknowledgeBatchIssue,
  editAndRevalidateRow,
  importSingleRow,
  skipRow,
  validateRowById,
} from "@/lib/import/resolution";
import { createValidationCache, type ValidationCache } from "@/lib/import/validationCache";

function redirectTo(
  request: Request,
  batchId: number,
  params: Record<string, string>,
): NextResponse {
  const url = adminUrl(request, `/admin/imports/${batchId}`);
  for (const [key, value] of Object.entries(params)) {
    if (key !== "anchor") url.searchParams.set(key, value);
  }
  const anchor = params.anchor;
  const hash = anchor ? `#${anchor}` : "";
  return NextResponse.redirect(`${url.toString()}${hash}`, { status: 303 });
}

function readString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNullableString(value: FormDataEntryValue | null): string | null | undefined {
  if (value === null) return undefined;
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function checkSessionCsrf(
  request: Request,
  form: FormData,
): Promise<{ error?: NextResponse; actor: string }> {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), actor: "" };
  }

  const csrf = form.get("csrf");
  if (typeof csrf !== "string" || !(await verifyAdminCsrfToken(csrf))) {
    return { error: NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 }), actor: "" };
  }

  return { actor: session.actor ?? "admin" };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const batchId = parseInt(id, 10);
  if (isNaN(batchId)) {
    return NextResponse.json({ error: "Invalid batch ID." }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return redirectTo(request, batchId, { error: "Invalid form data." });
  }

  const sessionCheck = await checkSessionCsrf(request, form);
  if (sessionCheck.error) return sessionCheck.error;
  const actor = sessionCheck.actor;

  const action = form.get("_action");
  if (typeof action !== "string") {
    return redirectTo(request, batchId, { error: "Missing action." });
  }

  const db = await getDatabase();

  // Build reference data cache once for all row operations in this request
  const cache = action === "edit_row" || action === "import_row"
    ? await createValidationCache(db).catch(() => undefined)
    : undefined;

  try {
    switch (action) {
      case "mark_friendly": return handleMarkFriendly(request, db, batchId, form, actor);
      case "create_competition": return handleCreateCompetition(request, db, batchId, form, actor);
      case "create_club": return handleCreateClub(request, db, batchId, form, actor);
      case "match_existing_club": return handleMatchExistingClub(request, db, batchId, form, actor);
      case "publish_pyramid_club": return handlePublishPyramidClub(request, db, batchId);
      case "assign_existing_venue": return handleAssignExistingVenue(request, db, batchId, form);
      case "create_venue_and_assign": return handleCreateVenueAndAssign(request, db, batchId, form);
      case "add_club_ticket_info": return handleAddClubTicketInfo(request, db, batchId, form, actor);
      case "acknowledge_missing_ticket_info": return handleAcknowledgeMissingTicketInfo(request, db, batchId, form, actor);
      case "edit_row": return handleEditRow(request, db, batchId, form, actor, cache);
      case "import_row": return handleImportRow(request, db, batchId, form, actor, cache);
      case "skip_row": return handleSkipRow(request, db, batchId, form, actor);
      default:
        return redirectTo(request, batchId, { error: `Unknown action: ${action}` });
    }
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    console.error(`[repairs] action="${action}" batch=${batchId} error:`, error);
    return redirectTo(request, batchId, { error: encodeURIComponent(message) });
  }
}

async function handleMarkFriendly(
  request: Request,
  db: import("@/lib/db/adapter").AppDatabase,
  batchId: number,
  form: FormData,
  actor: string,
) {
  const existing = await db.get<{ code: string }>(
    `SELECT code FROM competitions WHERE code = 'FRIENDLY'`
  );
  if (!existing) {
    await db.writeBatch([
      {
        sql: `INSERT INTO competitions (code, name, tier, kind) VALUES ('FRIENDLY', 'Non-League Friendlies', 10, 'friendly')`,
        params: [] as import("@/lib/db/adapter").QueryParam[],
      },
      buildAdminAuditLogWrite({
        action: "create",
        entityType: "competition",
        entityId: "FRIENDLY",
        actor,
        after: { code: "FRIENDLY", name: "Non-League Friendlies", kind: "friendly", import_batch_id: batchId },
      }),
    ]);
  }

  const redirectRowId = readString(form.get("redirect_row_id"));
  const rawValue = readString(form.get("raw_value"));

  if (redirectRowId) {
    // Row-scoped: validate ownership
    const parsed = parseInt(redirectRowId, 10);
    if (!isNaN(parsed)) {
      const row = await getRowOrError(db, parsed, batchId);
      if (!row) {
        return redirectTo(request, batchId, { error: "Row not found or belongs to a different batch." });
      }
      // Update only this row's competition_raw
      await db.run(
        `UPDATE import_batch_rows
         SET competition_raw = 'Non-League Friendlies',
             competition_resolved_code = NULL,
             match_result = NULL,
             warnings_json = NULL
         WHERE id = ? AND batch_id = ? AND final_action IS NULL`,
        [parsed, batchId]
      );
      await validateRowById(db, parsed);
    }
  } else if (rawValue) {
    // Raw-value scoped: update all rows with the exact same raw competition name
    await db.run(
      `UPDATE import_batch_rows
       SET competition_raw = 'Non-League Friendlies',
           competition_resolved_code = NULL,
           match_result = NULL,
           warnings_json = NULL
       WHERE batch_id = ?
         AND final_action IS NULL
         AND competition_raw = ?`,
      [batchId, rawValue]
    );
    const { validateImportBatch } = await import("@/lib/import/validation");
    await validateImportBatch(db, batchId);
  }

  const anchor = redirectRowId ? `fixture-${redirectRowId}` : undefined;
  return redirectTo(request, batchId, {
    success: "Marked as friendly outside formal competition.",
    ...(anchor ? { anchor } : {}),
  });
}

async function handleCreateCompetition(
  request: Request,
  db: import("@/lib/db/adapter").AppDatabase,
  batchId: number,
  form: FormData,
  actor: string,
) {
  const code = readString(form.get("code"));
  const name = readString(form.get("name"));
  if (!code || !name) {
    return redirectTo(request, batchId, { error: "Competition code and name are required." });
  }

  const kind = readString(form.get("kind"));
  if (!kind || !["league", "cup"].includes(kind)) {
    return redirectTo(request, batchId, { error: "Kind must be league or cup." });
  }

  let tier: number;
  if (kind === "league") {
    const tierStr = readString(form.get("tier"));
    tier = tierStr ? parseInt(tierStr, 10) : 0;
    if (tier < 1 || tier > 10) {
      return redirectTo(request, batchId, { error: "League competitions require a tier between 1 and 10." });
    }
  } else {
    // Cup/friendly use tier=10 internally
    tier = 10;
  }

  const existing = await db.get<{ code: string }>(
    `SELECT code FROM competitions WHERE code = ?`,
    [code]
  );
  if (existing) {
    return redirectTo(request, batchId, { error: `Competition "${code}" already exists. Map to it instead.` });
  }

  await db.writeBatch([
    {
      sql: `INSERT INTO competitions (code, name, tier, kind) VALUES (?, ?, ?, ?)`,
      params: [code, name, tier, kind],
    },
    buildAdminAuditLogWrite({
      action: "create",
      entityType: "competition",
      entityId: code,
      actor,
      after: { code, name, tier, kind, import_batch_id: batchId },
    }),
  ]);

  const { validateImportBatch } = await import("@/lib/import/validation");
  await validateImportBatch(db, batchId);

  return redirectTo(request, batchId, { success: `Competition "${name}" created.` });
}

async function handleCreateClub(
  request: Request,
  db: import("@/lib/db/adapter").AppDatabase,
  batchId: number,
  form: FormData,
  actor: string,
) {
  const name = readString(form.get("name"));
  const redirectRowId = readString(form.get("redirect_row_id"));
  const venueIdStr = readString(form.get("venue_id"));
  const createVenueName = readString(form.get("create_venue_name"));
  const alias = readNullableString(form.get("alias"));

  if (!name) {
    return redirectTo(request, batchId, { error: "Club name is required." });
  }

  let redirectRowIdParsed: number | undefined;
  if (redirectRowId) {
    const parsed = parseInt(redirectRowId, 10);
    if (!isNaN(parsed)) {
      const row = await getRowOrError(db, parsed, batchId);
      if (!row) {
        return redirectTo(request, batchId, { error: "Row not found or belongs to a different batch." });
      }
      redirectRowIdParsed = parsed;
    }
  }

  let venueId: number | null = null;

  // Preflight alias conflict before any writes (venue creation, club insert)
  if (alias && alias.trim() && alias.trim() !== name) {
    const normalized = normalizeName(alias.trim());
    const existingAlias = normalized ? await db.get<{ id: number }>(
      `SELECT id FROM club_aliases WHERE normalized_alias = ? AND competition_code IS NULL AND retired_at IS NULL`,
      [normalized]
    ) : null;
    if (existingAlias) {
      return redirectTo(request, batchId, { error: `Alias "${alias.trim()}" already exists for another club.` });
    }
    if (normalized === normalizeName(name)) {
      return redirectTo(request, batchId, { error: `Alias "${alias.trim()}" is the same as the club name.` });
    }
  }

  // Option A: select existing venue
  if (venueIdStr) {
    venueId = parseInt(venueIdStr, 10);
    if (isNaN(venueId) || venueId <= 0) venueId = null;
  }

  // Option B: create new venue inline (safe — alias preflighted above)
  if (!venueId && createVenueName) {
    const postcode = readString(form.get("create_venue_postcode"));
    const latitudeRaw = form.get("create_venue_latitude");
    const longitudeRaw = form.get("create_venue_longitude");
    if (!postcode || !latitudeRaw || !longitudeRaw) {
      return redirectTo(request, batchId, { error: "Venue requires postcode, latitude, and longitude." });
    }
    const latNum = Number(latitudeRaw);
    const lngNum = Number(longitudeRaw);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return redirectTo(request, batchId, { error: "Valid venue coordinates are required." });
    }
    const isApproximate = form.get("create_venue_is_approximate") === "1" ? 1 : 0;
    const coordinatePrecision = readString(form.get("create_venue_coordinate_precision")) ?? "ground_approximate";

    venueId = await createAdminVenue(db, {
      name: createVenueName,
      postcode,
      latitude: latNum,
      longitude: lngNum,
      is_approximate: isApproximate,
      coordinate_precision: coordinatePrecision,
    });
  }

  if (!venueId) {
    return redirectTo(request, batchId, { error: "Select an existing venue or provide venue details to create one." });
  }

  // Create club (competition_code nullable, no FRIENDLY workaround needed)
  const clubResult = await db.run(
    `INSERT INTO clubs (name, venue_id) VALUES (?, ?)`,
    [name, venueId]
  );
  const newClubId = clubResult.lastInsertRowid;
  if (!newClubId) throw new Error("Failed to create club record.");

  // Assign venue to the club
  await assignAdminVenue(db, newClubId as number, venueId, nextJuly1st());

  await db.writeBatch([
    buildAdminAuditLogWrite({
      action: "create",
      entityType: "club",
      entityId: newClubId as number,
      actor,
      after: { name, venue_id: venueId, import_batch_id: batchId },
    }),
  ]);

  // Add alias if different from name (already preflighted above)
  if (alias && alias.trim() && alias.trim() !== name) {
    try {
      await addAlias(db, newClubId as number, alias.trim(), { source: "import_batch_repair" });
    } catch {
      // Alias failure should not block club creation
    }
  }

  // If we created a venue, update the row's venueRaw so the card shows it
  if (redirectRowIdParsed && createVenueName) {
    await db.run(
      `UPDATE import_batch_rows SET venue_raw = ? WHERE id = ? AND venue_raw IS NULL`,
      [createVenueName, redirectRowIdParsed]
    );
  }

  // Revalidate affected row
  if (redirectRowIdParsed) {
    await validateRowById(db, redirectRowIdParsed);
  }

  const anchor = redirectRowIdParsed ? `fixture-${redirectRowIdParsed}` : undefined;
  return redirectTo(request, batchId, {
    success: `Club "${name}" created.`,
    ...(anchor ? { anchor } : {}),
  });
}

async function handleMatchExistingClub(
  request: Request,
  db: import("@/lib/db/adapter").AppDatabase,
  batchId: number,
  form: FormData,
  actor: string,
) {
  const alias = readString(form.get("alias"));
  const clubIdStr = readString(form.get("club_id"));
  const redirectRowId = readString(form.get("redirect_row_id"));

  if (!alias) {
    return redirectTo(request, batchId, { error: "Alias is required." });
  }
  if (!clubIdStr) {
    return redirectTo(request, batchId, { error: "Club ID is required." });
  }

  const clubId = parseInt(clubIdStr, 10);
  if (isNaN(clubId) || clubId <= 0) {
    return redirectTo(request, batchId, { error: "Invalid club ID." });
  }

  const competitionCode = readNullableString(form.get("competition_code"));

  await addAlias(db, clubId, alias.trim(), {
    competitionCode: competitionCode ?? undefined,
    source: "import_batch_repair",
  });

  await db.writeBatch([
    buildAdminAuditLogWrite({
      action: "create",
      entityType: "club_alias",
      actor,
      after: { clubId, alias, competitionCode: competitionCode ?? null, import_batch_id: batchId },
    }),
  ]);

  // Revalidate affected row
  if (redirectRowId) {
    const rowId = parseInt(redirectRowId, 10);
    if (!isNaN(rowId)) await validateRowById(db, rowId);
  }

  const anchor = redirectRowId ? `fixture-${redirectRowId}` : undefined;
  return redirectTo(request, batchId, {
    success: `Alias "${alias}" added.`,
    ...(anchor ? { anchor } : {}),
  });
}

async function handlePublishPyramidClub(
  request: Request,
  _db: import("@/lib/db/adapter").AppDatabase,
  batchId: number,
) {
  return redirectTo(request, batchId, { error: "Assign club to a division via /admin/publish." });
}

async function handleAssignExistingVenue(
  request: Request,
  db: import("@/lib/db/adapter").AppDatabase,
  batchId: number,
  form: FormData,
) {
  const clubIdStr = readString(form.get("club_id"));
  const venueIdStr = readString(form.get("venue_id"));
  const effectiveFrom = readString(form.get("effective_from"));
  const redirectRowId = readString(form.get("redirect_row_id"));

  if (!clubIdStr || !venueIdStr) {
    return redirectTo(request, batchId, { error: "Club ID and venue ID are required." });
  }

  const clubId = parseInt(clubIdStr, 10);
  const venueId = parseInt(venueIdStr, 10);
  if (isNaN(clubId) || isNaN(venueId)) {
    return redirectTo(request, batchId, { error: "Invalid club or venue ID." });
  }

  const effective = effectiveFrom && typeof effectiveFrom === "string" && isValidDate(effectiveFrom)
    ? effectiveFrom
    : nextJuly1st();

  await assignAdminVenue(db, clubId, venueId, effective);

  // Revalidate affected row
  if (redirectRowId) {
    const rowId = parseInt(redirectRowId, 10);
    if (!isNaN(rowId)) await validateRowById(db, rowId);
  }

  const anchor = redirectRowId ? `fixture-${redirectRowId}` : undefined;
  return redirectTo(request, batchId, {
    success: "Venue assigned.",
    ...(anchor ? { anchor } : {}),
  });
}

async function handleCreateVenueAndAssign(
  request: Request,
  db: import("@/lib/db/adapter").AppDatabase,
  batchId: number,
  form: FormData,
) {
  const name = readString(form.get("name"));
  const postcode = readString(form.get("postcode"));
  const latitudeRaw = form.get("latitude");
  const longitudeRaw = form.get("longitude");
  const clubIdStr = readString(form.get("club_id"));
  const effectiveFrom = readString(form.get("effective_from"));
  const redirectRowId = readString(form.get("redirect_row_id"));

  if (!name || !postcode) {
    return redirectTo(request, batchId, { error: "Venue name and postcode are required." });
  }

  const clubId = clubIdStr ? parseInt(clubIdStr, 10) : NaN;
  if (!clubIdStr || isNaN(clubId) || clubId <= 0) {
    return redirectTo(request, batchId, { error: "Club ID is required." });
  }

  const latNum = typeof latitudeRaw === "string" ? Number(latitudeRaw) : NaN;
  const lngNum = typeof longitudeRaw === "string" ? Number(longitudeRaw) : NaN;
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return redirectTo(request, batchId, { error: "Valid coordinates are required." });
  }

  const isApproximate = form.get("is_approximate") === "1" ? 1 : 0;
  const coordinatePrecision = readString(form.get("coordinate_precision")) ?? "ground_approximate";

  // Validate redirect_row_id before any writes
  let redirectRowIdParsed: number | undefined;
  if (redirectRowId) {
    const parsed = parseInt(redirectRowId, 10);
    if (!isNaN(parsed)) {
      const row = await getRowOrError(db, parsed, batchId);
      if (!row) {
        return redirectTo(request, batchId, { error: "Row not found or belongs to a different batch." });
      }
      redirectRowIdParsed = parsed;
    }
  }

  const newVenueId = await createAdminVenue(db, {
    name,
    postcode,
    latitude: latNum,
    longitude: lngNum,
    is_approximate: isApproximate,
    coordinate_precision: coordinatePrecision,
  });

  const effective = effectiveFrom && isValidDate(effectiveFrom)
    ? effectiveFrom
    : nextJuly1st();

  await assignAdminVenue(db, clubId, newVenueId, effective);

  if (redirectRowIdParsed) {
    await db.run(
      `UPDATE import_batch_rows SET venue_raw = ? WHERE id = ? AND venue_raw IS NULL`,
      [name, redirectRowIdParsed]
    );
  }

  // Revalidate affected row
  if (redirectRowIdParsed) {
    await validateRowById(db, redirectRowIdParsed);
  }

  const anchor = redirectRowIdParsed ? `fixture-${redirectRowIdParsed}` : undefined;
  return redirectTo(request, batchId, {
    success: `Venue "${name}" created and assigned to club.`,
    ...(anchor ? { anchor } : {}),
  });
}

async function handleAddClubTicketInfo(
  request: Request,
  db: import("@/lib/db/adapter").AppDatabase,
  batchId: number,
  form: FormData,
  actor: string,
) {
  const clubIdStr = readString(form.get("club_id"));
  const ticketUrl = readString(form.get("generic_ticket_url"));
  const redirectRowId = readString(form.get("redirect_row_id"));

  if (!clubIdStr || !ticketUrl) {
    return redirectTo(request, batchId, { error: "Club ID and ticket URL are required." });
  }

  const clubId = parseInt(clubIdStr, 10);
  if (isNaN(clubId)) {
    return redirectTo(request, batchId, { error: "Invalid club ID." });
  }

  const saleMode = readNullableString(form.get("sale_mode"));
  const adultPrice = readNullableString(form.get("adult_price_pence"));
  const concessionPrice = readNullableString(form.get("concession_price_pence"));
  const priceSourceUrl = readNullableString(form.get("price_source_url")) ?? ticketUrl;
  const confidence = readString(form.get("confidence")) ?? "imported";
  const verifiedAt = readString(form.get("verified_at")) ?? new Date().toISOString().split("T")[0];

  await db.run(
    `UPDATE clubs SET generic_ticket_url = ?, price_source_url = ? WHERE id = ?`,
    [ticketUrl, priceSourceUrl, clubId]
  );

  if (saleMode) {
    const adultPence = adultPrice ? parseInt(adultPrice, 10) : null;
    const concessionPence = concessionPrice ? parseInt(concessionPrice, 10) : null;
    await db.run(
      `INSERT INTO club_ticket_prices (club_id, sale_mode, adult_price_pence, concession_price_pence, source_url, verified_at, confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(club_id) DO UPDATE SET
         sale_mode = excluded.sale_mode,
         adult_price_pence = excluded.adult_price_pence,
         concession_price_pence = excluded.concession_price_pence,
         source_url = excluded.source_url,
         verified_at = excluded.verified_at,
         confidence = excluded.confidence`,
      [clubId, saleMode, adultPence, concessionPence, priceSourceUrl, verifiedAt, confidence]
    );
  }

  // Acknowledge the missing_ticket_info issue for the affected row so the warning clears
  let ackRowId: number | undefined;
  if (redirectRowId) {
    const parsed = parseInt(redirectRowId, 10);
    if (!isNaN(parsed)) {
      const row = await getRowOrError(db, parsed, batchId);
      if (!row) {
        return redirectTo(request, batchId, { error: "Row not found or belongs to a different batch." });
      }
      ackRowId = parsed;
    }
  }
  if (ackRowId) {
    await acknowledgeBatchIssue(db, batchId, "missing_ticket_info", actor, {
      issueCode: "missing_ticket_info",
      rowId: ackRowId,
    });
  }

  await db.writeBatch([
    buildAdminAuditLogWrite({
      action: "update",
      entityType: "club_ticket_price",
      entityId: clubId,
      actor,
      after: { clubId, generic_ticket_url: ticketUrl, import_batch_id: batchId },
    }),
  ]);

  const anchor = ackRowId ? `fixture-${ackRowId}` : undefined;
  return redirectTo(request, batchId, {
    success: "Ticket info saved.",
    ...(anchor ? { anchor } : {}),
  });
}

async function handleAcknowledgeMissingTicketInfo(
  request: Request,
  db: import("@/lib/db/adapter").AppDatabase,
  batchId: number,
  form: FormData,
  actor: string,
) {
  const issueKey = readString(form.get("issue_key"));
  const rowIdStr = readNullableString(form.get("row_id"));
  const note = readNullableString(form.get("note"));

  if (!issueKey) {
    return redirectTo(request, batchId, { error: "Issue key is required." });
  }

  const rowIdParsed = rowIdStr ? parseInt(rowIdStr, 10) : undefined;
  const finalRowId = rowIdParsed && !isNaN(rowIdParsed) ? rowIdParsed : undefined;

  if (finalRowId) {
    const rowCheck = await getRowOrError(db, finalRowId, batchId);
    if (!rowCheck) {
      return redirectTo(request, batchId, { error: "Row not found or belongs to a different batch." });
    }
  }

  await acknowledgeBatchIssue(db, batchId, issueKey, actor, {
    rowId: finalRowId,
    note: note ?? undefined,
    issueCode: "missing_ticket_info",
  });

  const anchor = finalRowId ? `fixture-${finalRowId}` : undefined;
  return redirectTo(request, batchId, {
    success: "Ticket info acknowledged for this batch.",
    ...(anchor ? { anchor } : {}),
  });
}

async function getRowOrError(
  db: import("@/lib/db/adapter").AppDatabase,
  rowId: number,
  batchId: number,
): Promise<import("@/lib/import/types").ImportBatchRow | null> {
  const row = await import("@/lib/import/importBatch").then((m) => m.getBatchRow(db, rowId));
  if (!row) return null;
  if (row.batchId !== batchId) return null;
  return row;
}

async function handleEditRow(
  request: Request,
  db: import("@/lib/db/adapter").AppDatabase,
  batchId: number,
  form: FormData,
  actor: string,
  cache?: ValidationCache,
) {
  const rowIdStr = readString(form.get("row_id"));
  if (!rowIdStr) {
    return redirectTo(request, batchId, { error: "Row ID is required." });
  }

  const rowId = parseInt(rowIdStr, 10);
  if (isNaN(rowId)) {
    return redirectTo(request, batchId, { error: "Invalid row ID." });
  }

  const row = await getRowOrError(db, rowId, batchId);
  if (!row) {
    return redirectTo(request, batchId, { error: "Row not found or belongs to a different batch." });
  }

  const edits: Record<string, string | null | undefined> = {};
  for (const field of ["homeParticipantRaw", "awayParticipantRaw", "competitionRaw", "venueRaw", "kickoffDate", "kickoffTime", "status", "ticketUrl", "sourceUrl"]) {
    const val = form.get(field);
    if (val !== null) {
      edits[field] = typeof val === "string" && val.length > 0 ? val : null;
    }
  }

  // Friendly checkbox overrides competition
  if (form.get("isFriendly") === "1") {
    edits.competitionRaw = "Non-League Friendlies";
  }

  const updated = await editAndRevalidateRow(db, rowId, edits as Parameters<typeof editAndRevalidateRow>[2], actor, { cache });
  const isBlocked = updated.matchResult === "blocked";
  const result = isBlocked ? "still blocked" : "ready";

  return redirectTo(request, batchId, {
    success: `Row ${rowId} updated and revalidated (${result}).`,
    anchor: `fixture-${rowId}`,
  });
}

async function handleImportRow(
  request: Request,
  db: import("@/lib/db/adapter").AppDatabase,
  batchId: number,
  form: FormData,
  actor: string,
  cache?: ValidationCache,
) {
  const rowIdStr = readString(form.get("row_id"));
  if (!rowIdStr) {
    return redirectTo(request, batchId, { error: "Row ID is required." });
  }

  const rowId = parseInt(rowIdStr, 10);
  if (isNaN(rowId)) {
    return redirectTo(request, batchId, { error: "Invalid row ID." });
  }

  const row = await getRowOrError(db, rowId, batchId);
  if (!row) {
    return redirectTo(request, batchId, { error: "Row not found or belongs to a different batch." });
  }

  const result = await importSingleRow(db, rowId, actor, { cache });

  if (!result.fixtureId) {
    return redirectTo(request, batchId, {
      error: "Row is still blocked. Fix issues first.",
      anchor: `fixture-${rowId}`,
    });
  }

  // Find next unresolved fixture
  const nextRow = await db.get<{ id: number }>(
    `SELECT id FROM import_batch_rows WHERE batch_id = ? AND final_action IS NULL AND id != ? ORDER BY row_index ASC LIMIT 1`,
    [batchId, rowId]
  );
  const nextAnchor = nextRow ? `fixture-${nextRow.id}` : undefined;

  return redirectTo(request, batchId, {
    success: `Fixture #${result.fixtureId} imported.`,
    ...(nextAnchor ? { anchor: nextAnchor } : {}),
  });
}

async function handleSkipRow(
  request: Request,
  db: import("@/lib/db/adapter").AppDatabase,
  batchId: number,
  form: FormData,
  actor: string,
) {
  const rowIdStr = readString(form.get("row_id"));
  const reason = readString(form.get("reason"));
  const note = readNullableString(form.get("note"));

  if (!rowIdStr || !reason) {
    return redirectTo(request, batchId, { error: "Row ID and reason are required." });
  }

  const rowId = parseInt(rowIdStr, 10);
  if (isNaN(rowId)) {
    return redirectTo(request, batchId, { error: "Invalid row ID." });
  }

  const row = await getRowOrError(db, rowId, batchId);
  if (!row) {
    return redirectTo(request, batchId, { error: "Row not found or belongs to a different batch." });
  }

  if (reason === "other" && !note) {
    return redirectTo(request, batchId, { error: "Note is required when reason is 'other'." });
  }

  await skipRow(db, rowId, reason, actor, note ?? undefined);

  // Find next unresolved fixture
  const nextRow = await db.get<{ id: number }>(
    `SELECT id FROM import_batch_rows WHERE batch_id = ? AND final_action IS NULL AND id != ? ORDER BY row_index ASC LIMIT 1`,
    [batchId, rowId]
  );
  const nextAnchor = nextRow ? `fixture-${nextRow.id}` : undefined;

  return redirectTo(request, batchId, {
    success: "Fixture skipped.",
    ...(nextAnchor ? { anchor: nextAnchor } : {}),
  });
}
