"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDatabase } from "@/lib/db/client";
import type { AppDatabase } from "@/lib/db/adapter";
import { getAdminSessionFromCookies } from "@/lib/admin/auth";
import { buildAdminAuditLogWrite } from "@/lib/admin/audit";
import { addAlias, normalizeName } from "@/lib/db/clubMapping";
import { createAdminVenue, assignAdminVenue, isValidDate, nextJuly1st } from "@/lib/admin/venues";
import {
  acknowledgeBatchIssue,
  editAndRevalidateRow,
  importSingleRow,
  skipRow,
  validateRowById,
} from "@/lib/import/resolution";
import { createValidationCache } from "@/lib/import/validationCache";
import { getBatch, getBatchRow } from "@/lib/import/importBatch";
import { applyBatchRows } from "@/lib/import/apply";

export interface ActionState {
  success?: string;
  error?: string;
}

function readString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNullableString(value: FormDataEntryValue | null): string | null | undefined {
  if (value === null) return undefined;
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function requireActor(): Promise<string> {
  const session = await getAdminSessionFromCookies();
  if (!session) throw new Error("Unauthorized");
  return session.actor ?? "admin";
}

async function getRowOrError(
  db: AppDatabase,
  rowId: number,
  batchId: number,
) {
  const row = await getBatchRow(db, rowId);
  if (!row) return null;
  if (row.batchId !== batchId) return null;
  return row;
}

async function revalidatePage(batchId: number) {
  revalidatePath(`/admin/imports/${batchId}`);
}

export async function editRow(
  batchId: number,
  rowId: number,
  _prev: ActionState | null,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireActor();
    const db = await getDatabase();

    const row = await getRowOrError(db, rowId, batchId);
    if (!row) return { error: "Row not found or belongs to a different batch." };

    const edits: Record<string, string | null | undefined> = {};
    for (const field of ["homeParticipantRaw", "awayParticipantRaw", "competitionRaw", "venueRaw", "kickoffDate", "kickoffTime", "status", "ticketUrl", "sourceUrl"]) {
      const val = form.get(field);
      if (val !== null) {
        edits[field] = typeof val === "string" && val.length > 0 ? val : null;
      }
    }

    if (form.get("isFriendly") === "1") {
      edits.competitionRaw = "Non-League Friendlies";
    }

    const cache = await createValidationCache(db).catch(() => undefined);
    const updated = await editAndRevalidateRow(db, rowId, edits as Parameters<typeof editAndRevalidateRow>[2], actor, { cache });
    const isBlocked = updated.matchResult === "blocked";
    const result = isBlocked ? "still blocked" : "ready";

    await revalidatePage(batchId);
    return { success: `Row ${rowId} updated and revalidated (${result}).` };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { error: message };
  }
}

export async function importRowAction(
  batchId: number,
  rowId: number,
): Promise<ActionState> {
  try {
    const actor = await requireActor();
    const db = await getDatabase();

    const row = await getRowOrError(db, rowId, batchId);
    if (!row) return { error: "Row not found or belongs to a different batch." };

    const cache = await createValidationCache(db).catch(() => undefined);
    const result = await importSingleRow(db, rowId, actor, { cache });

    if (!result.fixtureId) {
      return { error: "Row is still blocked. Fix issues first." };
    }

    await revalidatePage(batchId);
    return { success: `Fixture #${result.fixtureId} imported.` };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { error: message };
  }
}

export async function skipRowAction(
  batchId: number,
  rowId: number,
  _prev: ActionState | null,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireActor();
    const db = await getDatabase();

    const row = await getRowOrError(db, rowId, batchId);
    if (!row) return { error: "Row not found or belongs to a different batch." };

    const reason = readString(form.get("reason"));
    const note = readNullableString(form.get("note"));

    if (!reason) return { error: "Reason is required." };
    if (reason === "other" && !note) return { error: "Note is required when reason is 'other'." };

    await skipRow(db, rowId, reason, actor, note ?? undefined);

    await revalidatePage(batchId);
    return { success: "Fixture skipped." };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { error: message };
  }
}

export async function revalidateAll(
  batchId: number,
): Promise<ActionState> {
  try {
    await requireActor();
    const db = await getDatabase();

    const { validateImportBatch } = await import("@/lib/import/validation");
    const result = await validateImportBatch(db, batchId);

    await revalidatePage(batchId);
    return { success: `Revalidated all ${result.validatedCount} active rows (${result.insertCount} ready to insert, ${result.updateCount} ready to update, ${result.blockedCount} still blocked).` };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { error: message };
  }
}

export async function createCompetition(
  batchId: number,
  _prev: ActionState | null,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireActor();
    const db = await getDatabase();

    const code = readString(form.get("code"));
    const name = readString(form.get("name"));
    if (!code || !name) return { error: "Competition code and name are required." };

    const kind = readString(form.get("kind"));
    if (!kind || !["league", "cup"].includes(kind)) return { error: "Kind must be league or cup." };

    let tier: number;
    if (kind === "league") {
      const tierStr = readString(form.get("tier"));
      tier = tierStr ? parseInt(tierStr, 10) : 0;
      if (tier < 1 || tier > 10) return { error: "League competitions require a tier between 1 and 10." };
    } else {
      tier = 10;
    }

    const existing = await db.get<{ code: string }>(
      `SELECT code FROM competitions WHERE code = ?`, [code]
    );
    if (existing) return { error: `Competition "${code}" already exists. Map to it instead.` };

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

    await revalidatePage(batchId);
    return { success: `Competition "${name}" created.` };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { error: message };
  }
}

export async function createClub(
  batchId: number,
  _prev: ActionState | null,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireActor();
    const db = await getDatabase();

    const name = readString(form.get("name"));
    const redirectRowId = readString(form.get("redirect_row_id"));
    const venueIdStr = readString(form.get("venue_id"));
    const createVenueName = readString(form.get("create_venue_name"));
    const alias = readNullableString(form.get("alias"));

    if (!name) return { error: "Club name is required." };

    let redirectRowIdParsed: number | undefined;
    if (redirectRowId) {
      const parsed = parseInt(redirectRowId, 10);
      if (!isNaN(parsed)) {
        const row = await getRowOrError(db, parsed, batchId);
        if (!row) return { error: "Row not found or belongs to a different batch." };
        redirectRowIdParsed = parsed;
      }
    }

    let venueId: number | null = null;

    if (alias && alias.trim() && alias.trim() !== name) {
      const normalized = normalizeName(alias.trim());
      const existingAlias = normalized ? await db.get<{ id: number }>(
        `SELECT id FROM club_aliases WHERE normalized_alias = ? AND competition_code IS NULL AND retired_at IS NULL`,
        [normalized]
      ) : null;
      if (existingAlias) return { error: `Alias "${alias.trim()}" already exists for another club.` };
      if (normalized === normalizeName(name)) return { error: `Alias "${alias.trim()}" is the same as the club name.` };
    }

    if (venueIdStr) {
      venueId = parseInt(venueIdStr, 10);
      if (isNaN(venueId) || venueId <= 0) venueId = null;
    }

    if (!venueId && createVenueName) {
      const postcode = readString(form.get("create_venue_postcode"));
      const latitudeRaw = form.get("create_venue_latitude");
      const longitudeRaw = form.get("create_venue_longitude");
      if (!postcode || !latitudeRaw || !longitudeRaw) {
        return { error: "Venue requires postcode, latitude, and longitude." };
      }
      const latNum = Number(latitudeRaw);
      const lngNum = Number(longitudeRaw);
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        return { error: "Valid venue coordinates are required." };
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

    if (!venueId) return { error: "Select an existing venue or provide venue details to create one." };

    const clubResult = await db.run(
      `INSERT INTO clubs (name, venue_id) VALUES (?, ?)`, [name, venueId]
    );
    const newClubId = clubResult.lastInsertRowid;
    if (!newClubId) throw new Error("Failed to create club record.");

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

    if (alias && alias.trim() && alias.trim() !== name) {
      try {
        await addAlias(db, newClubId as number, alias.trim(), { source: "import_batch_repair" });
      } catch {
        // Alias failure should not block club creation
      }
    }

    if (redirectRowIdParsed && createVenueName) {
      await db.run(
        `UPDATE import_batch_rows SET venue_raw = ? WHERE id = ? AND venue_raw IS NULL`,
        [createVenueName, redirectRowIdParsed]
      );
    }

    if (redirectRowIdParsed) {
      await validateRowById(db, redirectRowIdParsed);
    }

    await revalidatePage(batchId);
    return { success: `Club "${name}" created.` };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { error: message };
  }
}

export async function matchExistingClub(
  batchId: number,
  _prev: ActionState | null,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireActor();
    const db = await getDatabase();

    const alias = readString(form.get("alias"));
    const clubIdStr = readString(form.get("club_id"));
    const redirectRowId = readString(form.get("redirect_row_id"));

    if (!alias) return { error: "Alias is required." };
    if (!clubIdStr) return { error: "Club ID is required." };

    const clubId = parseInt(clubIdStr, 10);
    if (isNaN(clubId) || clubId <= 0) return { error: "Invalid club ID." };

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

    if (redirectRowId) {
      const rowId = parseInt(redirectRowId, 10);
      if (!isNaN(rowId)) await validateRowById(db, rowId);
    }

    await revalidatePage(batchId);
    return { success: `Alias "${alias}" added.` };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { error: message };
  }
}

export async function assignExistingVenue(
  batchId: number,
  _prev: ActionState | null,
  form: FormData,
): Promise<ActionState> {
  try {
    await requireActor();
    const db = await getDatabase();

    const clubIdStr = readString(form.get("club_id"));
    const venueIdStr = readString(form.get("venue_id"));
    const effectiveFrom = readString(form.get("effective_from"));
    const redirectRowId = readString(form.get("redirect_row_id"));

    if (!clubIdStr || !venueIdStr) return { error: "Club ID and venue ID are required." };

    const clubId = parseInt(clubIdStr, 10);
    const venueId = parseInt(venueIdStr, 10);
    if (isNaN(clubId) || isNaN(venueId)) return { error: "Invalid club or venue ID." };

    const effective = effectiveFrom && isValidDate(effectiveFrom) ? effectiveFrom : nextJuly1st();

    await assignAdminVenue(db, clubId, venueId, effective);

    if (redirectRowId) {
      const rowId = parseInt(redirectRowId, 10);
      if (!isNaN(rowId)) await validateRowById(db, rowId);
    }

    await revalidatePage(batchId);
    return { success: "Venue assigned." };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { error: message };
  }
}

export async function createVenueAndAssign(
  batchId: number,
  _prev: ActionState | null,
  form: FormData,
): Promise<ActionState> {
  try {
    await requireActor();
    const db = await getDatabase();

    const name = readString(form.get("name"));
    const postcode = readString(form.get("postcode"));
    const latitudeRaw = form.get("latitude");
    const longitudeRaw = form.get("longitude");
    const clubIdStr = readString(form.get("club_id"));
    const effectiveFrom = readString(form.get("effective_from"));
    const redirectRowId = readString(form.get("redirect_row_id"));

    if (!name || !postcode) return { error: "Venue name and postcode are required." };

    const clubId = clubIdStr ? parseInt(clubIdStr, 10) : NaN;
    if (!clubIdStr || isNaN(clubId) || clubId <= 0) return { error: "Club ID is required." };

    const latNum = typeof latitudeRaw === "string" ? Number(latitudeRaw) : NaN;
    const lngNum = typeof longitudeRaw === "string" ? Number(longitudeRaw) : NaN;
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return { error: "Valid coordinates are required." };

    const isApproximate = form.get("is_approximate") === "1" ? 1 : 0;
    const coordinatePrecision = readString(form.get("coordinate_precision")) ?? "ground_approximate";

    let redirectRowIdParsed: number | undefined;
    if (redirectRowId) {
      const parsed = parseInt(redirectRowId, 10);
      if (!isNaN(parsed)) {
        const row = await getRowOrError(db, parsed, batchId);
        if (!row) return { error: "Row not found or belongs to a different batch." };
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

    const effective = effectiveFrom && isValidDate(effectiveFrom) ? effectiveFrom : nextJuly1st();
    await assignAdminVenue(db, clubId, newVenueId, effective);

    if (redirectRowIdParsed) {
      await db.run(
        `UPDATE import_batch_rows SET venue_raw = ? WHERE id = ? AND venue_raw IS NULL`,
        [name, redirectRowIdParsed]
      );
    }

    if (redirectRowIdParsed) {
      await validateRowById(db, redirectRowIdParsed);
    }

    await revalidatePage(batchId);
    return { success: `Venue "${name}" created and assigned to club.` };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { error: message };
  }
}

export async function addClubTicketInfo(
  batchId: number,
  _prev: ActionState | null,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireActor();
    const db = await getDatabase();

    const clubIdStr = readString(form.get("club_id"));
    const ticketUrl = readString(form.get("generic_ticket_url"));
    const redirectRowId = readString(form.get("redirect_row_id"));

    if (!clubIdStr || !ticketUrl) return { error: "Club ID and ticket URL are required." };

    const clubId = parseInt(clubIdStr, 10);
    if (isNaN(clubId)) return { error: "Invalid club ID." };

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

    let ackRowId: number | undefined;
    if (redirectRowId) {
      const parsed = parseInt(redirectRowId, 10);
      if (!isNaN(parsed)) {
        const row = await getRowOrError(db, parsed, batchId);
        if (!row) return { error: "Row not found or belongs to a different batch." };
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

    await revalidatePage(batchId);
    return { success: "Ticket info saved." };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { error: message };
  }
}

export async function acknowledgeMissingTicketInfo(
  batchId: number,
  _prev: ActionState | null,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireActor();
    const db = await getDatabase();

    const issueKey = readString(form.get("issue_key"));
    const rowIdStr = readNullableString(form.get("row_id"));
    const note = readNullableString(form.get("note"));

    if (!issueKey) return { error: "Issue key is required." };

    const rowIdParsed = rowIdStr ? parseInt(rowIdStr, 10) : undefined;
    const finalRowId = rowIdParsed && !isNaN(rowIdParsed) ? rowIdParsed : undefined;

    if (finalRowId) {
      const rowCheck = await getRowOrError(db, finalRowId, batchId);
      if (!rowCheck) return { error: "Row not found or belongs to a different batch." };
    }

    await acknowledgeBatchIssue(db, batchId, issueKey, actor, {
      rowId: finalRowId,
      note: note ?? undefined,
      issueCode: "missing_ticket_info",
    });

    await revalidatePage(batchId);
    return { success: "Ticket info acknowledged for this batch." };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { error: message };
  }
}

export async function bulkApply(
  batchId: number,
  _prev: ActionState | null,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireActor();
    const confirm = form.get("confirm");
    if (confirm !== "1") return { error: "Please confirm the apply action." };

    const db = await getDatabase();
    const result = await applyBatchRows(db, batchId, actor);

    await revalidatePage(batchId);
    return { success: `Imported ${result.inserted} new fixtures, updated ${result.updated}, skipped ${result.skipped}.` };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { error: message };
  }
}

export async function deleteBatchAction(
  batchId: number,
  _prev: ActionState | null,
  form: FormData,
): Promise<ActionState> {
  let db: AppDatabase | undefined;
  try {
    const session = await getAdminSessionFromCookies();
    if (!session) return { error: "Unauthorized" };

    const confirm = form.get("confirm");
    if (confirm !== "1") return { error: "Please confirm the delete action." };

    db = await getDatabase();
    const batch = await getBatch(db, batchId);
    const { deleteBatch: del } = await import("@/lib/import/importBatch");
    await del(db, batchId);
    await db.writeBatch([
      buildAdminAuditLogWrite({
        action: "delete",
        entityType: "import_batch",
        entityId: batchId,
        actor: session.actor ?? "admin",
        before: batch
          ? { sourceId: batch.sourceId, rowCountTotal: batch.rowCountTotal, approvalStatus: batch.approvalStatus }
          : undefined,
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { error: message };
  }

  redirect("/admin/imports");
}
