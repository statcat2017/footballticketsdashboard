import { getDatabase } from "@/lib/db/client";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import type { SqlWrite } from "@/lib/db/adapter";

export interface AdminVenueRow {
  id: number;
  name: string;
  postcode: string;
  latitude: number;
  longitude: number;
  is_approximate: number;
  admin_updated_at: string | null;
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
}

export interface AdminVenueUpdateInput {
  name?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  is_approximate?: number;
}

export function nextJuly1st(): string {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  return `${year}-07-01`;
}

export async function getAdminVenueList(): Promise<AdminVenueListRow[]> {
  const db = await getDatabase();

  return db.all<AdminVenueListRow>(
    `SELECT
      v.id, v.name, v.postcode, v.latitude, v.longitude, v.is_approximate, v.admin_updated_at,
      COUNT(cva.id) AS current_club_count
    FROM venues v
    LEFT JOIN club_venue_assignments cva
      ON cva.venue_id = v.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    GROUP BY v.id
    ORDER BY v.name`
  );
}

export async function getAdminVenue(venueId: number): Promise<AdminVenueDetailData | null> {
  const db = await getDatabase();

  const venue = await db.get<AdminVenueRow>(
    `SELECT id, name, postcode, latitude, longitude, is_approximate, admin_updated_at
     FROM venues WHERE id = ?`,
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
    `INSERT INTO venues (name, postcode, latitude, longitude, is_approximate, admin_updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.name, input.postcode, input.latitude, input.longitude, input.is_approximate ?? 0, now]
  );

  const venueId = result.lastInsertRowid!;

  await writeAdminAuditLog(db, {
    action: "create",
    entityType: "venue",
    entityId: venueId,
    after: { name: input.name, postcode: input.postcode, latitude: input.latitude, longitude: input.longitude, is_approximate: input.is_approximate ?? 0 }
  });

  return venueId;
}

export async function updateAdminVenue(
  venueId: number,
  input: AdminVenueUpdateInput,
  confirmed: boolean
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const current = await db.get<AdminVenueRow>(
    `SELECT id, name, postcode, latitude, longitude, is_approximate FROM venues WHERE id = ?`,
    [venueId]
  );

  if (!current) {
    throw new Error("Venue not found.");
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

  const updatedName = input.name ?? current.name;
  const updatedPostcode = input.postcode ?? current.postcode;
  const updatedLatitude = input.latitude ?? current.latitude;
  const updatedLongitude = input.longitude ?? current.longitude;
  const updatedIsApproximate = input.is_approximate ?? current.is_approximate;

  await db.run(
    `UPDATE venues
     SET name = ?, postcode = ?, latitude = ?, longitude = ?, is_approximate = ?, admin_updated_at = ?
     WHERE id = ?`,
    [updatedName, updatedPostcode, updatedLatitude, updatedLongitude, updatedIsApproximate, now, venueId]
  );

  await writeAdminAuditLog(db, {
    action: "update",
    entityType: "venue",
    entityId: venueId,
    before: { name: current.name, postcode: current.postcode, latitude: current.latitude, longitude: current.longitude, is_approximate: current.is_approximate },
    after: { name: updatedName, postcode: updatedPostcode, latitude: updatedLatitude, longitude: updatedLongitude, is_approximate: updatedIsApproximate }
  });
}

export async function assignAdminVenue(
  clubId: number,
  venueId: number,
  effectiveFrom: string
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const statements: SqlWrite[] = [];

  const oldAssignment = await db.get<{ id: number; effective_from: string }>(
    `SELECT id, effective_from
     FROM club_venue_assignments
     WHERE club_id = ? AND is_primary = 1 AND effective_to IS NULL`,
    [clubId]
  );

  if (oldAssignment) {
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
