import type { AppDatabase, SqlWrite } from "@/lib/db/adapter";
import { buildAdminAuditLogWrite } from "@/lib/admin/audit";
import {
  getClubById,
  getDivisionByIdWithMaxSize,
  getDivisionAssignmentByClubId,
  getCurrentDivisionOfClub,
  getDivisionIdByClubId,
  getClubWithDivisionAssignment,
  getClubCountInDivision,
  getCurrentSeasonLabel,
  getMovementTargets,
  getSameLevelDivisionsExcluding,
  getClubsInDivision as getClubsInDivisionQuery,
} from "@/lib/admin/queries";

export interface DivisionAssignedClub {
  id: number;
  name: string;
  venueName: string | null;
  venuePostcode: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  hasTicketUrl: boolean;
}

export interface DivisionGroup {
  id: number;
  name: string;
  level: number;
  maxSize: number;
  displayOrder: number | null;
  clubs: DivisionAssignedClub[];
  clubCount: number;
}

export interface UnassignedClub {
  id: number;
  name: string;
  venueName: string | null;
}

export interface DivisionAssignmentViewData {
  seasonLabel: string;
  divisions: DivisionGroup[];
  unassignedClubs: UnassignedClub[];
}

export async function getDivisionAssignments(db: AppDatabase): Promise<DivisionAssignmentViewData> {
  const season = await db.get<{ season_label: string }>(
    "SELECT season_label FROM pyramid_seasons ORDER BY id DESC LIMIT 1"
  );

  const rows = await db.all<{
    division_id: number;
    division_name: string;
    division_level: number;
    max_size: number;
    display_order: number | null;
    club_id: number | null;
    club_name: string | null;
    venue_name: string | null;
    venue_postcode: string | null;
    venue_latitude: number | null;
    venue_longitude: number | null;
    generic_ticket_url: string | null;
  }>(
    `SELECT
      d.id AS division_id,
      d.name AS division_name,
      d.level AS division_level,
      d.max_size,
      d.display_order,
      c.id AS club_id,
      c.name AS club_name,
      v.name AS venue_name,
      v.postcode AS venue_postcode,
      v.latitude AS venue_latitude,
      v.longitude AS venue_longitude,
      c.generic_ticket_url
    FROM pyramid_divisions d
    LEFT JOIN division_assignments da ON da.division_id = d.id
    LEFT JOIN clubs c ON c.id = da.club_id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    ORDER BY d.level, d.display_order, c.name`
  );

  const unassignedRows = await db.all<{
    id: number;
    name: string;
    venue_name: string | null;
  }>(
    `SELECT c.id, c.name, v.name AS venue_name
    FROM clubs c
    LEFT JOIN division_assignments da ON da.club_id = c.id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE da.id IS NULL
    ORDER BY c.name`
  );

  const divMap = new Map<number, DivisionGroup>();

  for (const row of rows) {
    let group = divMap.get(row.division_id);
    if (!group) {
      group = {
        id: row.division_id,
        name: row.division_name,
        level: row.division_level,
        maxSize: row.max_size,
        displayOrder: row.display_order,
        clubs: [],
        clubCount: 0,
      };
      divMap.set(row.division_id, group);
    }
    if (row.club_id !== null) {
      group.clubs.push({
        id: row.club_id,
        name: row.club_name!,
        venueName: row.venue_name,
        venuePostcode: row.venue_postcode,
        venueLatitude: row.venue_latitude,
        venueLongitude: row.venue_longitude,
        hasTicketUrl: !!row.generic_ticket_url,
      });
    }
  }

  const divisions = Array.from(divMap.values()).map((d) => ({
    ...d,
    clubCount: d.clubs.length,
  }));

  return {
    seasonLabel: season?.season_label ?? "",
    divisions,
    unassignedClubs: unassignedRows.map((r) => ({
      id: r.id,
      name: r.name,
      venueName: r.venue_name,
    })),
  };
}

export async function assignClubToDivision(
  db: AppDatabase,
  clubId: number,
  divisionId: number,
  actor: string
): Promise<{ warning?: string }> {
  const club = await getClubById(db, clubId);
  if (!club) throw new Error(`Club ${clubId} not found.`);

  const division = await getDivisionByIdWithMaxSize(db, divisionId);
  if (!division) throw new Error(`Division ${divisionId} not found.`);

  const existingAssignment = await getDivisionAssignmentByClubId(db, clubId);

  const currentCount = await getClubCountInDivision(db, divisionId);

  if (existingAssignment?.division_id !== divisionId && currentCount && currentCount.count >= division.max_size) {
    throw new Error(`Division "${division.name}" is at capacity (${division.max_size} clubs). Remove a club first or increase the division size.`);
  }

  const now = new Date().toISOString();

  const before = existingAssignment
    ? { club_id: clubId, division_id: existingAssignment.division_id }
    : null;
  const after = { club_id: clubId, division_id: divisionId };

  const statements: SqlWrite[] = existingAssignment
    ? [{
      sql: "UPDATE division_assignments SET division_id = ?, admin_updated_at = ? WHERE id = ?",
      params: [divisionId, now, existingAssignment.id]
    }]
    : [{
      sql: "INSERT INTO division_assignments (club_id, division_id, admin_updated_at) VALUES (?, ?, ?)",
      params: [clubId, divisionId, now]
    }];

  statements.push(buildAdminAuditLogWrite({
    action: existingAssignment ? "update" : "create",
    entityType: "division_assignment",
    entityId: clubId,
    actor,
    before,
    after,
  }));

  await db.writeBatch(statements);

  return {};
}

export async function moveClubToDivision(
  db: AppDatabase,
  clubId: number,
  targetDivisionId: number,
  actor: string
): Promise<{ warning?: string }> {
  return assignClubToDivision(db, clubId, targetDivisionId, actor);
}

export async function unassignClub(
  db: AppDatabase,
  clubId: number,
  actor: string
): Promise<void> {
  const club = await getClubById(db, clubId);
  if (!club) throw new Error(`Club ${clubId} not found.`);

  const existing = await getDivisionIdByClubId(db, clubId);
  if (!existing) throw new Error(`Club ${clubId} is not assigned to any division.`);

  const statements: SqlWrite[] = [{
    sql: "DELETE FROM division_assignments WHERE club_id = ?",
    params: [clubId]
  }];

  statements.push(buildAdminAuditLogWrite({
    action: "delete",
    entityType: "division_assignment",
    entityId: clubId,
    actor,
    before: { club_id: clubId, division_id: existing.division_id },
    after: null,
  }));

  await db.writeBatch(statements);
}

export interface DivisionDetail {
  id: number;
  name: string;
  level: number;
  maxSize: number;
  displayOrder: number | null;
  clubs: DivisionAssignedClub[];
  clubCount: number;
  missingVenueCount: number;
  missingTicketUrlCount: number;
  seasonLabel: string;
}

export interface DivisionOption {
  id: number;
  name: string;
  level: number;
}

export interface ClubOption {
  id: number;
  name: string;
}

export async function getPromoteTargets(db: AppDatabase, divisionId: number): Promise<DivisionOption[]> {
  return getMovementTargets(db, divisionId, "promotion");
}

export async function getRelegateTargets(db: AppDatabase, divisionId: number): Promise<DivisionOption[]> {
  return getMovementTargets(db, divisionId, "relegation");
}

export async function getMigrateTargets(db: AppDatabase, divisionId: number): Promise<DivisionOption[]> {
  return getSameLevelDivisionsExcluding(db, divisionId);
}

export async function getClubsInDivision(db: AppDatabase, divisionId: number): Promise<ClubOption[]> {
  return getClubsInDivisionQuery(db, divisionId);
}

export async function moveClubWithSwap(
  db: AppDatabase,
  clubId: number,
  targetDivisionId: number,
  swapClubId: number | null,
  movementType: "promote" | "relegate" | "migrate",
  actor: string
): Promise<{ warning?: string }> {
  const club = await getClubById(db, clubId);
  if (!club) throw new Error(`Club ${clubId} not found.`);

  const currentDivision = await getCurrentDivisionOfClub(db, clubId);
  if (!currentDivision) throw new Error(`Club ${clubId} is not assigned to any division.`);

  const targetDivision = await getDivisionByIdWithMaxSize(db, targetDivisionId);
  if (!targetDivision) throw new Error(`Target division ${targetDivisionId} not found.`);

  if (currentDivision.id === targetDivisionId) {
    throw new Error("Club is already in that division.");
  }

  if (movementType === "promote" && targetDivision.level >= currentDivision.level) {
    throw new Error(`Promote target "${targetDivision.name}" (level ${targetDivision.level}) must be a lower level than current (level ${currentDivision.level}).`);
  }
  if (movementType === "relegate" && targetDivision.level <= currentDivision.level) {
    throw new Error(`Relegate target "${targetDivision.name}" (level ${targetDivision.level}) must be a higher level than current (level ${currentDivision.level}).`);
  }
  if (movementType === "migrate" && targetDivision.level !== currentDivision.level) {
    throw new Error(`Migrate target "${targetDivision.name}" (level ${targetDivision.level}) must be the same level as current (level ${currentDivision.level}).`);
  }

  let swapClub: { id: number; name: string; division_id: number } | undefined;
  if (swapClubId !== null) {
    swapClub = await getClubWithDivisionAssignment(db, swapClubId);
    if (!swapClub) throw new Error(`Swap club ${swapClubId} not found.`);
    if (swapClub.division_id !== targetDivisionId) {
      throw new Error(`Swap club is not in the target division.`);
    }
    if (swapClub.id === clubId) {
      throw new Error("Cannot swap a club with itself.");
    }
  }

  if (swapClubId === null) {
    const targetCount = await getClubCountInDivision(db, targetDivisionId);
    if (targetCount && targetCount.count >= targetDivision.max_size) {
      throw new Error(`Target division "${targetDivision.name}" is at capacity (${targetDivision.max_size} clubs).`);
    }
  }

  const now = new Date().toISOString();

  const statements: SqlWrite[] = [];

  if (swapClub) {
    const swapAssignment = await getDivisionAssignmentByClubId(db, swapClub.id);
    const movingAssignment = await getDivisionAssignmentByClubId(db, clubId);

    statements.push({
      sql: "UPDATE division_assignments SET division_id = ?, admin_updated_at = ? WHERE id = ?",
      params: [targetDivisionId, now, movingAssignment!.id]
    });
    statements.push({
      sql: "UPDATE division_assignments SET division_id = ?, admin_updated_at = ? WHERE id = ?",
      params: [currentDivision.id, now, swapAssignment!.id]
    });
  } else {
    const movingAssignment = await getDivisionAssignmentByClubId(db, clubId);
    statements.push({
      sql: "UPDATE division_assignments SET division_id = ?, admin_updated_at = ? WHERE id = ?",
      params: [targetDivisionId, now, movingAssignment!.id]
    });
  }

  statements.push(buildAdminAuditLogWrite({
    action: "update",
    entityType: "club_movement",
    entityId: clubId,
    actor,
    before: { club_id: clubId, from_division_id: currentDivision.id, to_division_id: targetDivisionId, movement_type: movementType, swap_club_id: swapClub?.id ?? null },
    after: { club_id: clubId, from_division_id: currentDivision.id, to_division_id: targetDivisionId, movement_type: movementType, swap_club_id: swapClub?.id ?? null },
  }));

  await db.writeBatch(statements);

  let warning: string | undefined;
  if (swapClub) {
    warning = `Swapped ${club.name} with ${swapClub.name}.`;
  }

  return { warning };
}

export async function unassignClubFromTier10(
  db: AppDatabase,
  clubId: number,
  actor: string
): Promise<void> {
  const club = await getClubById(db, clubId);
  if (!club) throw new Error(`Club ${clubId} not found.`);

  const currentDivision = await getCurrentDivisionOfClub(db, clubId);
  if (!currentDivision) throw new Error(`Club ${clubId} is not assigned to any division.`);

  if (currentDivision.level !== 10) {
    throw new Error("Club is not at tier 10.");
  }

  const statements: SqlWrite[] = [{
    sql: "DELETE FROM division_assignments WHERE club_id = ?",
    params: [clubId]
  }];

  statements.push(buildAdminAuditLogWrite({
    action: "delete",
    entityType: "club_relegation_unassigned",
    entityId: clubId,
    actor,
    before: { club_id: clubId, division_id: currentDivision.id, reason: "relegated below tier 10" },
    after: null,
  }));

  await db.writeBatch(statements);
}

export async function getDivisionDetail(
  db: AppDatabase,
  divisionId: number
): Promise<DivisionDetail | null> {
  const season = await getCurrentSeasonLabel(db);

  const division = await db.get<{
    id: number;
    name: string;
    level: number;
    max_size: number;
    display_order: number | null;
  }>(
    `SELECT d.id, d.name, d.level, d.max_size, d.display_order
     FROM pyramid_divisions d
     WHERE d.id = ?`,
    [divisionId]
  );

  if (!division) return null;

  const clubRows = await db.all<{
    club_id: number;
    club_name: string;
    venue_name: string | null;
    venue_postcode: string | null;
    venue_latitude: number | null;
    venue_longitude: number | null;
    generic_ticket_url: string | null;
  }>(
    `SELECT
      c.id AS club_id,
      c.name AS club_name,
      v.name AS venue_name,
      v.postcode AS venue_postcode,
      v.latitude AS venue_latitude,
      v.longitude AS venue_longitude,
      c.generic_ticket_url
    FROM division_assignments da
    JOIN clubs c ON c.id = da.club_id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE da.division_id = ?
    ORDER BY c.name`,
    [divisionId]
  );

  const clubs: DivisionAssignedClub[] = clubRows.map((r) => ({
    id: r.club_id,
    name: r.club_name,
    venueName: r.venue_name,
    venuePostcode: r.venue_postcode,
    venueLatitude: r.venue_latitude,
    venueLongitude: r.venue_longitude,
    hasTicketUrl: !!r.generic_ticket_url,
  }));

  const clubCount = clubs.length;
  const missingVenueCount = clubs.filter((c) => !c.venueName).length;
  const missingTicketUrlCount = clubs.filter((c) => !c.hasTicketUrl).length;

  return {
    id: division.id,
    name: division.name,
    level: division.level,
    maxSize: division.max_size,
    displayOrder: division.display_order,
    clubs,
    clubCount,
    missingVenueCount,
    missingTicketUrlCount,
    seasonLabel: season?.season_label ?? "",
  };
}
