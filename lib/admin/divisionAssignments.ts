import type { AppDatabase, SqlWrite } from "@/lib/db/adapter";
import { buildAdminAuditLogWrite } from "@/lib/admin/audit";

export interface DivisionAssignedClub {
  id: number;
  name: string;
  status: string;
  venueName: string | null;
  hasTicketUrl: boolean;
  isPublished: boolean;
}

export interface DivisionGroup {
  id: number;
  name: string;
  level: number;
  maxSize: number;
  displayOrder: number | null;
  competitionCode: string | null;
  isPublished: boolean;
  clubs: DivisionAssignedClub[];
  clubCount: number;
}

export interface UnassignedClub {
  id: number;
  name: string;
  status: string;
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
    competition_code: string | null;
    is_published: number;
    club_id: number | null;
    club_name: string | null;
    club_status: string | null;
    venue_name: string | null;
    generic_ticket_url: string | null;
    club_competition_code: string | null;
  }>(
    `SELECT
      d.id AS division_id,
      d.name AS division_name,
      d.level AS division_level,
      d.max_size,
      d.display_order,
      dcm.competition_code,
      CASE WHEN dcm.id IS NOT NULL THEN 1 ELSE 0 END AS is_published,
      c.id AS club_id,
      c.name AS club_name,
      c.status AS club_status,
      v.name AS venue_name,
      c.generic_ticket_url,
      c.competition_code AS club_competition_code
    FROM pyramid_divisions d
    LEFT JOIN division_assignments da ON da.division_id = d.id
    LEFT JOIN clubs c ON c.id = da.club_id
      AND NOT EXISTS (
        SELECT 1 FROM competitions comp
        WHERE comp.code = c.competition_code AND comp.kind = 'friendly'
      )
      AND NOT (
        EXISTS (
          SELECT 1
          FROM fixtures f
          JOIN competitions comp ON comp.code = f.competition_code
          WHERE comp.kind = 'friendly'
            AND (f.home_club_id = c.id OR f.away_club_id = c.id)
        )
        AND NOT EXISTS (
          SELECT 1
          FROM fixtures f
          JOIN competitions comp ON comp.code = f.competition_code
          WHERE comp.kind != 'friendly'
            AND (f.home_club_id = c.id OR f.away_club_id = c.id)
        )
      )
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    LEFT JOIN division_competition_mappings dcm ON dcm.division_id = d.id
    ORDER BY d.level, d.display_order, c.name`
  );

  const unassignedRows = await db.all<{
    id: number;
    name: string;
    status: string;
    venue_name: string | null;
  }>(
    `SELECT c.id, c.name, c.status, v.name AS venue_name
    FROM clubs c
    LEFT JOIN division_assignments da ON da.club_id = c.id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE da.id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM competitions comp
        WHERE comp.code = c.competition_code AND comp.kind = 'friendly'
      )
      AND NOT (
        EXISTS (
          SELECT 1
          FROM fixtures f
          JOIN competitions comp ON comp.code = f.competition_code
          WHERE comp.kind = 'friendly'
            AND (f.home_club_id = c.id OR f.away_club_id = c.id)
        )
        AND NOT EXISTS (
          SELECT 1
          FROM fixtures f
          JOIN competitions comp ON comp.code = f.competition_code
          WHERE comp.kind != 'friendly'
            AND (f.home_club_id = c.id OR f.away_club_id = c.id)
        )
      )
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
        competitionCode: row.competition_code,
        isPublished: row.is_published === 1,
        clubs: [],
        clubCount: 0,
      };
      divMap.set(row.division_id, group);
    }
    if (row.club_id !== null) {
      group.clubs.push({
        id: row.club_id,
        name: row.club_name!,
        status: row.club_status!,
        venueName: row.venue_name,
        hasTicketUrl: !!row.generic_ticket_url,
        isPublished: row.club_competition_code !== null && row.club_status === "known",
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
      status: r.status,
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
  const club = await db.get<{ id: number; name: string; competition_code: string | null }>(
    "SELECT id, name, competition_code FROM clubs WHERE id = ?",
    [clubId]
  );
  if (!club) throw new Error(`Club ${clubId} not found.`);

  const division = await db.get<{ id: number; name: string; max_size: number }>(
    "SELECT id, name, max_size FROM pyramid_divisions WHERE id = ?",
    [divisionId]
  );
  if (!division) throw new Error(`Division ${divisionId} not found.`);

  const existingAssignment = await db.get<{ id: number; division_id: number }>(
    "SELECT id, division_id FROM division_assignments WHERE club_id = ?",
    [clubId]
  );

  const currentCount = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM division_assignments WHERE division_id = ?",
    [divisionId]
  );

  let warning: string | undefined;
  if (existingAssignment?.division_id !== divisionId && currentCount && currentCount.count >= division.max_size) {
    warning = `Division "${division.name}" is at capacity (${division.max_size} clubs).`;
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

  if (club.competition_code !== null) {
    statements.push({
      sql: "UPDATE clubs SET competition_code = NULL, admin_updated_at = ? WHERE id = ?",
      params: [now, clubId]
    });
  }

  statements.push(buildAdminAuditLogWrite({
    action: existingAssignment ? "update" : "create",
    entityType: "division_assignment",
    entityId: clubId,
    actor,
    before,
    after,
  }));

  await db.writeBatch(statements);

  return { warning };
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
  const club = await db.get<{ id: number; name: string; competition_code: string | null }>(
    "SELECT id, name, competition_code FROM clubs WHERE id = ?",
    [clubId]
  );
  if (!club) throw new Error(`Club ${clubId} not found.`);

  const existing = await db.get<{ division_id: number }>(
    "SELECT division_id FROM division_assignments WHERE club_id = ?",
    [clubId]
  );
  if (!existing) throw new Error(`Club ${clubId} is not assigned to any division.`);

  const now = new Date().toISOString();

  const statements: SqlWrite[] = [{
    sql: "DELETE FROM division_assignments WHERE club_id = ?",
    params: [clubId]
  }];

  if (club.competition_code !== null) {
    statements.push({
      sql: "UPDATE clubs SET competition_code = NULL, admin_updated_at = ? WHERE id = ?",
      params: [now, clubId]
    });
  }

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
