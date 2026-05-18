import { getDatabase } from "@/lib/db/client";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { distanceMiles } from "@/lib/distance";
import type { SqlWrite } from "@/lib/db/adapter";

export interface AdminVenueRow {
  id: number;
  name: string;
  postcode: string;
  latitude: number;
  longitude: number;
  is_approximate: number;
  admin_updated_at: string | null;
  coordinate_precision: string | null;
  coordinates_verified_at: string | null;
  coordinates_confidence: string | null;
  coordinates_notes: string | null;
}

export interface AdminVenueListRow extends AdminVenueRow {
  current_club_count: number;
}

export interface AdminVenueDetailData {
  venue: AdminVenueRow;
  sharingClubs: Array<{ id: number; name: string }>;
}

export interface AdminVenueCreateInput {
  name: string;
  postcode: string;
  latitude: number;
  longitude: number;
  is_approximate?: number;
  coordinate_precision?: string;
  coordinates_confidence?: string;
  coordinates_notes?: string;
}

export interface AdminVenueUpdateInput {
  name?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  is_approximate?: number;
  coordinate_precision?: string;
  coordinates_confidence?: string;
  coordinates_notes?: string;
}

export interface AdminVenueUpdateResult {
  invalidatedTravelCount: number;
}

export function nextJuly1st(): string {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  return `${year}-07-01`;
}

export function isValidDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().split("T")[0] === str;
}

const venueSelectColumns = `v.id, v.name, v.postcode, v.latitude, v.longitude, v.is_approximate, v.admin_updated_at,
  v.coordinate_precision, v.coordinates_verified_at, v.coordinates_confidence, v.coordinates_notes`;

export async function getAdminVenueList(options?: { approximateOnly?: boolean }): Promise<AdminVenueListRow[]> {
  const db = await getDatabase();

  return db.all<AdminVenueListRow>(
    `SELECT
      ${venueSelectColumns},
      COUNT(cva.id) AS current_club_count
    FROM venues v
    LEFT JOIN club_venue_assignments cva
      ON cva.venue_id = v.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    ${options?.approximateOnly ? "WHERE v.is_approximate = 1" : ""}
    GROUP BY v.id
    ORDER BY v.name`
  );
}

export async function getAdminVenue(venueId: number): Promise<AdminVenueDetailData | null> {
  const db = await getDatabase();

  const venue = await db.get<AdminVenueRow>(
    `SELECT ${venueSelectColumns}
     FROM venues v WHERE v.id = ?`,
    [venueId]
  );

  if (!venue) {
    return null;
  }

  const sharingClubs = await db.all<{ id: number; name: string }>(
    `SELECT pc.id, pc.name
     FROM club_venue_assignments cva
     JOIN pyramid_clubs pc ON pc.id = cva.club_id
     WHERE cva.venue_id = ? AND cva.is_primary = 1 AND cva.effective_to IS NULL
     ORDER BY pc.name`,
    [venueId]
  );

  return { venue, sharingClubs };
}

export async function createAdminVenue(input: AdminVenueCreateInput): Promise<number> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const result = await db.run(
    `INSERT INTO venues (name, postcode, latitude, longitude, is_approximate, admin_updated_at,
      coordinate_precision, coordinates_confidence, coordinates_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name, input.postcode, input.latitude, input.longitude,
      input.is_approximate ?? 0, now,
      input.coordinate_precision ?? null,
      input.coordinates_confidence ?? null,
      input.coordinates_notes ?? null
    ]
  );

  const venueId = result.lastInsertRowid!;

  await writeAdminAuditLog(db, {
    action: "create",
    entityType: "venue",
    entityId: venueId,
    after: {
      name: input.name, postcode: input.postcode,
      latitude: input.latitude, longitude: input.longitude,
      is_approximate: input.is_approximate ?? 0,
      coordinate_precision: input.coordinate_precision,
      coordinates_confidence: input.coordinates_confidence,
      coordinates_notes: input.coordinates_notes
    }
  });

  return venueId;
}

export async function updateAdminVenue(
  venueId: number,
  input: AdminVenueUpdateInput,
  confirmed: boolean
): Promise<AdminVenueUpdateResult> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const current = await db.get<AdminVenueRow>(
    `SELECT id, name, postcode, latitude, longitude, is_approximate,
      coordinate_precision, coordinates_confidence, coordinates_notes
     FROM venues WHERE id = ?`,
    [venueId]
  );

  if (!current) {
    throw new Error("Venue not found.");
  }

  if (input.latitude !== undefined && (!Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90)) {
    throw new Error("Invalid latitude.");
  }

  if (input.longitude !== undefined && (!Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180)) {
    throw new Error("Invalid longitude.");
  }

  if (!confirmed) {
    const sharingCount = await db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM club_venue_assignments
       WHERE venue_id = ? AND is_primary = 1 AND effective_to IS NULL`,
      [venueId]
    );

    if (sharingCount && sharingCount.count > 1) {
      throw new Error("Venue is shared by multiple clubs. Confirmation required.");
    }
  }

  const updatedLatitude = input.latitude ?? current.latitude;
  const updatedLongitude = input.longitude ?? current.longitude;

  const coordsChanged =
    updatedLatitude !== current.latitude ||
    updatedLongitude !== current.longitude;
  const distanceMoved = coordsChanged
    ? distanceMiles(
        { latitude: current.latitude, longitude: current.longitude },
        { latitude: updatedLatitude, longitude: updatedLongitude }
      )
    : 0;

  return db.writeBatch(buildUpdateStatements(venueId, input, current, now, coordsChanged, distanceMoved)).then((results) => {
    let invalidatedTravelCount = 0;
    if (coordsChanged && distanceMoved > 1) {
      invalidatedTravelCount = results[0].changes;
    }
    return { invalidatedTravelCount };
  });
}

function buildUpdateStatements(
  venueId: number,
  input: AdminVenueUpdateInput,
  current: AdminVenueRow,
  now: string,
  coordsChanged: boolean,
  distanceMoved: number
): SqlWrite[] {
  const statements: SqlWrite[] = [];

  if (coordsChanged && distanceMoved > 1) {
    statements.push({
      sql: "DELETE FROM travel_cache WHERE venue_id = ?",
      params: [venueId]
    });
  }

  const updatedName = input.name ?? current.name;
  const updatedPostcode = input.postcode ?? current.postcode;
  const updatedLatitude = input.latitude ?? current.latitude;
  const updatedLongitude = input.longitude ?? current.longitude;
  const updatedIsApproximate = input.is_approximate ?? current.is_approximate;
  const updatedCoordinatePrecision = input.coordinate_precision ?? current.coordinate_precision;
  const updatedCoordinatesConfidence = input.coordinates_confidence ?? current.coordinates_confidence;
  const updatedCoordinatesNotes = input.coordinates_notes ?? current.coordinates_notes;

  statements.push({
    sql: `UPDATE venues
          SET name = ?, postcode = ?, latitude = ?, longitude = ?, is_approximate = ?,
              admin_updated_at = ?, coordinate_precision = ?, coordinates_confidence = ?, coordinates_notes = ?
          WHERE id = ?`,
    params: [
      updatedName, updatedPostcode, updatedLatitude, updatedLongitude, updatedIsApproximate,
      now, updatedCoordinatePrecision, updatedCoordinatesConfidence, updatedCoordinatesNotes, venueId
    ]
  });

  statements.push({
    sql: `INSERT INTO admin_audit_log (actor, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)`,
    params: [
      "admin",
      "update",
      "venue",
      String(venueId),
      JSON.stringify({
        name: current.name, postcode: current.postcode,
        latitude: current.latitude, longitude: current.longitude,
        is_approximate: current.is_approximate,
        coordinate_precision: current.coordinate_precision,
        coordinates_confidence: current.coordinates_confidence,
        coordinates_notes: current.coordinates_notes
      }),
      JSON.stringify({
        name: updatedName, postcode: updatedPostcode,
        latitude: updatedLatitude, longitude: updatedLongitude,
        is_approximate: updatedIsApproximate,
        coordinate_precision: updatedCoordinatePrecision,
        coordinates_confidence: updatedCoordinatesConfidence,
        coordinates_notes: updatedCoordinatesNotes
      })
    ]
  });

  return statements;
}

export async function assignAdminVenue(
  clubId: number,
  venueId: number,
  effectiveFrom: string
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const statements: SqlWrite[] = [];

  const club = await db.get<{ id: number }>("SELECT id FROM pyramid_clubs WHERE id = ?", [clubId]);
  if (!club) throw new Error("Club not found.");

  const venue = await db.get<{ id: number }>("SELECT id FROM venues WHERE id = ?", [venueId]);
  if (!venue) throw new Error("Venue not found.");

  if (!isValidDate(effectiveFrom)) {
    throw new Error("Invalid effective_from date.");
  }

  const oldAssignment = await db.get<{ id: number; effective_from: string; venue_id: number }>(
    `SELECT id, effective_from, venue_id
     FROM club_venue_assignments
     WHERE club_id = ? AND is_primary = 1 AND effective_to IS NULL`,
    [clubId]
  );

  if (oldAssignment) {
    if (effectiveFrom <= oldAssignment.effective_from) {
      throw new Error("Effective date must be after the current assignment start date.");
    }

    if (oldAssignment.venue_id === venueId) {
      throw new Error("Club is already assigned to this venue.");
    }

    const endDate = calcDayBefore(effectiveFrom);
    statements.push({
      sql: `UPDATE club_venue_assignments
            SET effective_to = ?, admin_updated_at = ?
            WHERE id = ?`,
      params: [endDate, now, oldAssignment.id]
    });
  }

  statements.push({
    sql: `INSERT INTO club_venue_assignments (club_id, venue_id, effective_from, effective_to, is_primary, admin_updated_at)
          VALUES (?, ?, ?, NULL, 1, ?)`,
    params: [clubId, venueId, effectiveFrom, now]
  });

  await db.writeBatch(statements);

  await writeAdminAuditLog(db, {
    action: "update",
    entityType: "club_venue_assignment",
    entityId: clubId,
    before: oldAssignment ? { venue_assignment_id: oldAssignment.id, effective_to: calcDayBefore(effectiveFrom) } : null,
    after: { venue_id: venueId, effective_from: effectiveFrom, is_primary: 1 }
  });
}

function calcDayBefore(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}
