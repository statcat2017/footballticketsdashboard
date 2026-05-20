import type { AppDatabase, SqlWrite } from "@/lib/db/adapter";
import { buildAdminAuditLogWrite } from "@/lib/admin/audit";

export interface DivisionAssignedClub {
  id: number;
  name: string;
  status: string;
  venueName: string | null;
  hasTicketUrl: boolean;
  isPublished: boolean;
  isFriendlyOnly: boolean;
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
    is_friendly_only: number;
  }>(
    `WITH
    friendly_clubs AS (
      SELECT c.id AS club_id FROM clubs c
      JOIN competitions comp ON comp.code = c.competition_code AND comp.kind = 'friendly'
      UNION
      SELECT f.home_club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind = 'friendly'
      WHERE f.home_club_id IS NOT NULL
      UNION
      SELECT f.away_club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind = 'friendly'
      WHERE f.away_club_id IS NOT NULL
    ),
    league_clubs AS (
      SELECT f.home_club_id AS club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind != 'friendly'
      WHERE f.home_club_id IS NOT NULL
      UNION
      SELECT f.away_club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind != 'friendly'
      WHERE f.away_club_id IS NOT NULL
    ),
    friendly_only_clubs AS (
      SELECT club_id FROM friendly_clubs
      EXCEPT
      SELECT club_id FROM league_clubs
    )
    SELECT
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
      c.competition_code AS club_competition_code,
      CASE WHEN c.id IN (SELECT club_id FROM friendly_only_clubs) THEN 1 ELSE 0 END AS is_friendly_only
    FROM pyramid_divisions d
    LEFT JOIN division_assignments da ON da.division_id = d.id
    LEFT JOIN clubs c ON c.id = da.club_id
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
    `WITH
    friendly_clubs AS (
      SELECT c.id AS club_id FROM clubs c
      JOIN competitions comp ON comp.code = c.competition_code AND comp.kind = 'friendly'
      UNION
      SELECT f.home_club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind = 'friendly'
      WHERE f.home_club_id IS NOT NULL
      UNION
      SELECT f.away_club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind = 'friendly'
      WHERE f.away_club_id IS NOT NULL
    ),
    league_clubs AS (
      SELECT f.home_club_id AS club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind != 'friendly'
      WHERE f.home_club_id IS NOT NULL
      UNION
      SELECT f.away_club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind != 'friendly'
      WHERE f.away_club_id IS NOT NULL
    ),
    friendly_only_clubs AS (
      SELECT club_id FROM friendly_clubs
      EXCEPT
      SELECT club_id FROM league_clubs
    )
    SELECT c.id, c.name, c.status, v.name AS venue_name
    FROM clubs c
    LEFT JOIN division_assignments da ON da.club_id = c.id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE da.id IS NULL
      AND c.id NOT IN (SELECT club_id FROM friendly_only_clubs)
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
        isFriendlyOnly: row.is_friendly_only === 1,
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

export interface DivisionDetail {
  id: number;
  name: string;
  level: number;
  maxSize: number;
  displayOrder: number | null;
  competitionCode: string | null;
  isPublished: boolean;
  clubs: DivisionAssignedClub[];
  clubCount: number;
  publishedCount: number;
  missingVenueCount: number;
  missingTicketUrlCount: number;
  friendlyOnlyCount: number;
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
  return db.all<DivisionOption>(
    `SELECT pd.id, pd.name, pd.level
     FROM pyramid_edges pe
     JOIN pyramid_divisions pd ON pd.id = pe.to_division_id
     WHERE pe.from_division_id = ? AND pe.movement_type = 'promotion'
     ORDER BY pd.level, pd.name`,
    [divisionId]
  );
}

export async function getRelegateTargets(db: AppDatabase, divisionId: number): Promise<DivisionOption[]> {
  return db.all<DivisionOption>(
    `SELECT pd.id, pd.name, pd.level
     FROM pyramid_edges pe
     JOIN pyramid_divisions pd ON pd.id = pe.to_division_id
     WHERE pe.from_division_id = ? AND pe.movement_type = 'relegation'
     ORDER BY pd.level, pd.name`,
    [divisionId]
  );
}

export async function getMigrateTargets(db: AppDatabase, divisionId: number): Promise<DivisionOption[]> {
  const current = await db.get<{ level: number }>(
    "SELECT level FROM pyramid_divisions WHERE id = ?",
    [divisionId]
  );
  if (!current) return [];

  return db.all<DivisionOption>(
    `SELECT id, name, level FROM pyramid_divisions
     WHERE level = ? AND id != ?
     ORDER BY name`,
    [current.level, divisionId]
  );
}

export async function getClubsInDivision(db: AppDatabase, divisionId: number): Promise<ClubOption[]> {
  return db.all<ClubOption>(
    `SELECT c.id, c.name
     FROM division_assignments da
     JOIN clubs c ON c.id = da.club_id
     WHERE da.division_id = ?
     ORDER BY c.name`,
    [divisionId]
  );
}

export async function moveClubWithSwap(
  db: AppDatabase,
  clubId: number,
  targetDivisionId: number,
  swapClubId: number | null,
  movementType: "promote" | "relegate" | "migrate",
  actor: string
): Promise<{ warning?: string }> {
  const club = await db.get<{ id: number; name: string; competition_code: string | null }>(
    "SELECT id, name, competition_code FROM clubs WHERE id = ?",
    [clubId]
  );
  if (!club) throw new Error(`Club ${clubId} not found.`);

  const currentDivision = await db.get<{ id: number; name: string; level: number }>(
    `SELECT pd.id, pd.name, pd.level
     FROM division_assignments da
     JOIN pyramid_divisions pd ON pd.id = da.division_id
     WHERE da.club_id = ?`,
    [clubId]
  );
  if (!currentDivision) throw new Error(`Club ${clubId} is not assigned to any division.`);

  const targetDivision = await db.get<{ id: number; name: string; level: number; max_size: number }>(
    "SELECT id, name, level, max_size FROM pyramid_divisions WHERE id = ?",
    [targetDivisionId]
  );
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
    swapClub = await db.get<{ id: number; name: string; division_id: number }>(
      `SELECT c.id, c.name, da.division_id
       FROM division_assignments da
       JOIN clubs c ON c.id = da.club_id
       WHERE da.club_id = ?`,
      [swapClubId]
    );
    if (!swapClub) throw new Error(`Swap club ${swapClubId} not found.`);
    if (swapClub.division_id !== targetDivisionId) {
      throw new Error(`Swap club is not in the target division.`);
    }
    if (swapClub.id === clubId) {
      throw new Error("Cannot swap a club with itself.");
    }
  }

  if (swapClubId === null) {
    const targetCount = await db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM division_assignments WHERE division_id = ?",
      [targetDivisionId]
    );
    if (targetCount && targetCount.count >= targetDivision.max_size) {
      throw new Error(`Target division "${targetDivision.name}" is at capacity (${targetDivision.max_size} clubs).`);
    }
  }

  const now = new Date().toISOString();

  const statements: SqlWrite[] = [];

  if (swapClub) {
    const swapAssignment = await db.get<{ id: number }>(
      "SELECT id FROM division_assignments WHERE club_id = ?",
      [swapClub.id]
    );
    const movingAssignment = await db.get<{ id: number }>(
      "SELECT id FROM division_assignments WHERE club_id = ?",
      [clubId]
    );

    statements.push({
      sql: "UPDATE division_assignments SET division_id = ?, admin_updated_at = ? WHERE id = ?",
      params: [targetDivisionId, now, movingAssignment!.id]
    });
    statements.push({
      sql: "UPDATE division_assignments SET division_id = ?, admin_updated_at = ? WHERE id = ?",
      params: [currentDivision.id, now, swapAssignment!.id]
    });
  } else {
    const movingAssignment = await db.get<{ id: number }>(
      "SELECT id FROM division_assignments WHERE club_id = ?",
      [clubId]
    );
    statements.push({
      sql: "UPDATE division_assignments SET division_id = ?, admin_updated_at = ? WHERE id = ?",
      params: [targetDivisionId, now, movingAssignment!.id]
    });
  }

  if (club.competition_code !== null) {
    statements.push({
      sql: "UPDATE clubs SET competition_code = NULL, admin_updated_at = ? WHERE id = ?",
      params: [now, clubId]
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
  const club = await db.get<{ id: number; name: string; competition_code: string | null }>(
    "SELECT id, name, competition_code FROM clubs WHERE id = ?",
    [clubId]
  );
  if (!club) throw new Error(`Club ${clubId} not found.`);

  const currentDivision = await db.get<{ id: number; name: string; level: number }>(
    `SELECT pd.id, pd.name, pd.level
     FROM division_assignments da
     JOIN pyramid_divisions pd ON pd.id = da.division_id
     WHERE da.club_id = ?`,
    [clubId]
  );
  if (!currentDivision) throw new Error(`Club ${clubId} is not assigned to any division.`);

  if (currentDivision.level !== 10) {
    throw new Error("Club is not at tier 10.");
  }

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
  const season = await db.get<{ season_label: string }>(
    "SELECT season_label FROM pyramid_seasons ORDER BY id DESC LIMIT 1"
  );

  const division = await db.get<{
    id: number;
    name: string;
    level: number;
    max_size: number;
    display_order: number | null;
    competition_code: string | null;
    is_published: number;
  }>(
    `SELECT d.id, d.name, d.level, d.max_size, d.display_order,
            dcm.competition_code,
            CASE WHEN dcm.id IS NOT NULL THEN 1 ELSE 0 END AS is_published
     FROM pyramid_divisions d
     LEFT JOIN division_competition_mappings dcm ON dcm.division_id = d.id
     WHERE d.id = ?`,
    [divisionId]
  );

  if (!division) return null;

  const clubRows = await db.all<{
    club_id: number;
    club_name: string;
    club_status: string;
    venue_name: string | null;
    generic_ticket_url: string | null;
    club_competition_code: string | null;
    is_friendly_only: number;
  }>(
    `WITH
    friendly_clubs AS (
      SELECT c.id AS club_id FROM clubs c
      JOIN competitions comp ON comp.code = c.competition_code AND comp.kind = 'friendly'
      UNION
      SELECT f.home_club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind = 'friendly'
      WHERE f.home_club_id IS NOT NULL
      UNION
      SELECT f.away_club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind = 'friendly'
      WHERE f.away_club_id IS NOT NULL
    ),
    league_clubs AS (
      SELECT f.home_club_id AS club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind != 'friendly'
      WHERE f.home_club_id IS NOT NULL
      UNION
      SELECT f.away_club_id FROM fixtures f
      JOIN competitions comp ON comp.code = f.competition_code AND comp.kind != 'friendly'
      WHERE f.away_club_id IS NOT NULL
    ),
    friendly_only_clubs AS (
      SELECT club_id FROM friendly_clubs
      EXCEPT
      SELECT club_id FROM league_clubs
    )
    SELECT
      c.id AS club_id,
      c.name AS club_name,
      c.status AS club_status,
      v.name AS venue_name,
      c.generic_ticket_url,
      c.competition_code AS club_competition_code,
      CASE WHEN c.id IN (SELECT club_id FROM friendly_only_clubs) THEN 1 ELSE 0 END AS is_friendly_only
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
    status: r.club_status,
    venueName: r.venue_name,
    hasTicketUrl: !!r.generic_ticket_url,
    isPublished: r.club_competition_code !== null && r.club_status === "known",
    isFriendlyOnly: r.is_friendly_only === 1,
  }));

  const clubCount = clubs.length;
  const publishedCount = clubs.filter((c) => c.isPublished).length;
  const missingVenueCount = clubs.filter((c) => !c.venueName).length;
  const missingTicketUrlCount = clubs.filter((c) => !c.hasTicketUrl).length;
  const friendlyOnlyCount = clubs.filter((c) => c.isFriendlyOnly).length;

  return {
    id: division.id,
    name: division.name,
    level: division.level,
    maxSize: division.max_size,
    displayOrder: division.display_order,
    competitionCode: division.competition_code,
    isPublished: division.is_published === 1,
    clubs,
    clubCount,
    publishedCount,
    missingVenueCount,
    missingTicketUrlCount,
    friendlyOnlyCount,
    seasonLabel: season?.season_label ?? "",
  };
}
