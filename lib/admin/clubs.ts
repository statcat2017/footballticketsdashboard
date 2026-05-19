import { getDatabase } from "@/lib/db/client";
import type { AppDatabase } from "@/lib/db/adapter";
import { writeAdminAuditLog } from "@/lib/admin/audit";

export interface AdminClubUpdateInput {
  name?: string;
  aliases?: string | null;
  status?: string;
  source_url?: string | null;
  verified_at?: string | null;
}

export interface AdminClubRow {
  club_id: number;
  club_name: string;
  club_status: string;
  venue_id: number | null;
  venue_name: string | null;
  venue_postcode: string | null;
}

export interface AdminDivisionGroup {
  season_division_id: number;
  division_id: number;
  division_name: string;
  division_level: number;
  clubs: AdminClubRow[];
}

export interface AdminClubListData {
  season_label: string;
  divisions: AdminDivisionGroup[];
  unassignedClubs: AdminClubRow[];
}

interface ClubDivisionRow {
  season_label: string;
  season_division_id: number;
  division_id: number;
  division_name: string;
  division_level: number;
  club_id: number;
  club_name: string;
  club_status: string;
  venue_id: number | null;
  venue_name: string | null;
  venue_postcode: string | null;
}

export interface AdminClubDetailData {
  club: {
    id: number;
    name: string;
    aliases: string | null;
    status: string;
    source_url: string | null;
    verified_at: string | null;
  };
  season: {
    label: string;
    division_id: number;
    division_name: string;
    division_level: number;
  };
  primaryVenue: {
    id: number;
    name: string;
    postcode: string;
    latitude: number;
    longitude: number;
    is_approximate: number;
  } | null;
  venueAssignments: Array<{
    assignment_id: number;
    is_primary: number;
    effective_from: string;
    effective_to: string | null;
    venue_id: number;
    venue_name: string;
    venue_postcode: string;
  }>;
  sharingClubs: Array<{
    id: number;
    name: string;
  }>;
  warnings: string[];
}

interface ClubDetailRow {
  id: number;
  name: string;
  aliases: string | null;
  status: string;
  source_url: string | null;
  verified_at: string | null;
  division_id: number;
  division_name: string;
  division_level: number;
  season_label: string;
  venue_id: number | null;
  venue_name: string | null;
  venue_postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  is_approximate: number | null;
}

interface VenueAssignmentRow {
  assignment_id: number;
  is_primary: number;
  effective_from: string;
  effective_to: string | null;
  venue_id: number;
  venue_name: string;
  venue_postcode: string;
}

interface SharingClubRow {
  id: number;
  name: string;
}

export async function getLatestSeasonId(db: AppDatabase): Promise<number> {
  const row = await db.get<{ id: number }>("SELECT id FROM pyramid_seasons ORDER BY id DESC LIMIT 1");

  if (!row) {
    throw new Error("No pyramid seasons found.");
  }

  return row.id;
}

export async function getAdminClubList(): Promise<AdminClubListData> {
  const db = await getDatabase();
  const seasonId = await getLatestSeasonId(db);
  const season = await db.get<{ season_label: string }>("SELECT season_label FROM pyramid_seasons WHERE id = ?", [seasonId]);

  const rows = await db.all<ClubDivisionRow>(
    `SELECT
      ps.season_label,
      psd.id AS season_division_id,
      d.id AS division_id,
      d.name AS division_name,
      d.level AS division_level,
      c.id AS club_id,
      c.name AS club_name,
      c.status AS club_status,
      v.id AS venue_id,
      v.name AS venue_name,
      v.postcode AS venue_postcode
    FROM pyramid_season_memberships psm
    JOIN pyramid_season_divisions psd ON psd.id = psm.season_division_id
    JOIN pyramid_divisions d ON d.id = psd.division_id
    JOIN pyramid_seasons ps ON ps.id = psm.season_id
    JOIN clubs c ON c.id = psm.club_id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE psm.season_id = ?
    ORDER BY d.level, d.name, c.name`,
    [seasonId]
  );

  const unassignedRows = await db.all<AdminClubRow>(
    `SELECT c.id AS club_id, c.name AS club_name, c.status AS club_status,
      v.id AS venue_id, v.name AS venue_name, v.postcode AS venue_postcode
    FROM clubs c
    LEFT JOIN pyramid_season_memberships psm ON psm.club_id = c.id AND psm.season_id = ?
    LEFT JOIN club_venue_assignments cva ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE psm.id IS NULL
    ORDER BY c.name`,
    [seasonId]
  );

  const divisions = new Map<number, AdminDivisionGroup>();

  for (const row of rows) {
    let group = divisions.get(row.season_division_id);

    if (!group) {
      group = {
        season_division_id: row.season_division_id,
        division_id: row.division_id,
        division_name: row.division_name,
        division_level: row.division_level,
        clubs: []
      };
      divisions.set(row.season_division_id, group);
    }

    group.clubs.push({
      club_id: row.club_id,
      club_name: row.club_name,
      club_status: row.club_status,
      venue_id: row.venue_id,
      venue_name: row.venue_name,
      venue_postcode: row.venue_postcode
    });
  }

  return {
    season_label: season?.season_label ?? "",
    divisions: Array.from(divisions.values()),
    unassignedClubs: unassignedRows
  };
}

export async function getAdminClubDetail(clubId: number): Promise<AdminClubDetailData | null> {
  const db = await getDatabase();
  const seasonId = await getLatestSeasonId(db);

  const clubRow = await db.get<ClubDetailRow>(
    `SELECT
      c.id, c.name, c.aliases, c.status, c.source_url, c.verified_at,
      d.id AS division_id, d.name AS division_name, d.level AS division_level,
      ps.season_label,
      v.id AS venue_id, v.name AS venue_name, v.postcode AS venue_postcode,
      v.latitude, v.longitude, v.is_approximate
    FROM clubs c
    LEFT JOIN pyramid_season_memberships psm ON psm.club_id = c.id AND psm.season_id = ?
    LEFT JOIN pyramid_season_divisions psd ON psd.id = psm.season_division_id AND psm.season_id = psd.season_id
    LEFT JOIN pyramid_divisions d ON d.id = psd.division_id
    LEFT JOIN pyramid_seasons ps ON ps.id = psm.season_id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE c.id = ?`,
    [seasonId, clubId]
  );

  if (!clubRow) {
    return null;
  }

  const venueAssignments = await db.all<VenueAssignmentRow>(
    `SELECT
      cva.id AS assignment_id, cva.is_primary, cva.effective_from, cva.effective_to,
      v.id AS venue_id, v.name AS venue_name, v.postcode AS venue_postcode
    FROM club_venue_assignments cva
    JOIN venues v ON v.id = cva.venue_id
    WHERE cva.club_id = ?
    ORDER BY cva.effective_from DESC`,
    [clubId]
  );

  let sharingClubs: SharingClubRow[] = [];

  if (clubRow.venue_id) {
    sharingClubs = await db.all<SharingClubRow>(
      `SELECT c.id, c.name
      FROM club_venue_assignments cva
      JOIN clubs c ON c.id = cva.club_id
      WHERE cva.venue_id = ? AND cva.is_primary = 1 AND cva.effective_to IS NULL
        AND cva.club_id != ?`,
      [clubRow.venue_id, clubId]
    );
  }

  const warnings: string[] = [];

  if (!clubRow.venue_id) {
    warnings.push("No current primary ground assigned.");
  }

  if (sharingClubs.length > 0) {
    warnings.push(`Shares primary ground with: ${sharingClubs.map((c) => c.name).join(", ")}.`);
  }

  return {
    club: {
      id: clubRow.id,
      name: clubRow.name,
      aliases: clubRow.aliases,
      status: clubRow.status,
      source_url: clubRow.source_url,
      verified_at: clubRow.verified_at
    },
    season: clubRow.season_label
      ? {
          label: clubRow.season_label,
          division_id: clubRow.division_id!,
          division_name: clubRow.division_name!,
          division_level: clubRow.division_level!
        }
      : {
          label: "Unassigned",
          division_id: 0,
          division_name: "No division",
          division_level: 0
        },
    primaryVenue: clubRow.venue_id
      ? {
          id: clubRow.venue_id,
          name: clubRow.venue_name!,
          postcode: clubRow.venue_postcode!,
          latitude: clubRow.latitude!,
          longitude: clubRow.longitude!,
          is_approximate: clubRow.is_approximate!
        }
      : null,
    venueAssignments,
    sharingClubs,
    warnings
  };
}

export async function updateAdminClub(clubId: number, input: AdminClubUpdateInput): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const current = await db.get<{
    id: number; name: string; aliases: string | null;
    status: string; source_url: string | null; verified_at: string | null;
  }>(
    `SELECT id, name, aliases, status, source_url, verified_at FROM clubs WHERE id = ?`,
    [clubId]
  );

  if (!current) {
    throw new Error("Club not found.");
  }

  const updatedName = input.name ?? current.name;
  const updatedAliases = input.aliases !== undefined ? input.aliases : current.aliases;
  const updatedStatus = input.status ?? current.status;
  const updatedSourceUrl = input.source_url !== undefined ? input.source_url : current.source_url;
  const updatedVerifiedAt = input.verified_at !== undefined ? input.verified_at : current.verified_at;

  await db.run(
    `UPDATE clubs
     SET name = ?, aliases = ?, status = ?, source_url = ?, verified_at = ?, admin_updated_at = ?
     WHERE id = ?`,
    [updatedName, updatedAliases, updatedStatus, updatedSourceUrl, updatedVerifiedAt, now, clubId]
  );

  await writeAdminAuditLog(db, {
    action: "update",
    entityType: "club",
    entityId: clubId,
    before: {
      name: current.name,
      aliases: current.aliases,
      status: current.status,
      source_url: current.source_url,
      verified_at: current.verified_at
    },
    after: {
      name: updatedName,
      aliases: updatedAliases,
      status: updatedStatus,
      source_url: updatedSourceUrl,
      verified_at: updatedVerifiedAt
    }
  });
}

export interface PublishableDivision {
  id: number;
  name: string;
  level: number;
  clubCount: number;
  isPublished: boolean;
  competitionCode: string | null;
}

export interface PublishableClub {
  id: number;
  name: string;
  divisionId: number;
  divisionName: string;
  venueName: string | null;
  isPublished: boolean;
}

export async function getPublishableDivisions(): Promise<PublishableDivision[]> {
  const db = await getDatabase();
  const seasonId = await getLatestSeasonId(db);
  const rows = await db.all<{
    id: number; name: string; level: number; clubCount: number; competition_code: string | null;
  }>(
    `SELECT
      d.id, d.name, d.level,
      COUNT(psm.id) AS clubCount,
      dcm.competition_code
    FROM pyramid_season_divisions psd
    JOIN pyramid_divisions d ON d.id = psd.division_id
    JOIN pyramid_season_memberships psm ON psm.season_division_id = psd.id
    LEFT JOIN division_competition_mappings dcm ON dcm.division_id = d.id
    WHERE psd.season_id = ?
    GROUP BY d.id
    ORDER BY d.level, d.name`,
    [seasonId]
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    clubCount: row.clubCount,
    isPublished: row.competition_code !== null,
    competitionCode: row.competition_code
  }));
}

export async function getPublishableClubs(divisionId?: number): Promise<PublishableClub[]> {
  const db = await getDatabase();
  const seasonId = await getLatestSeasonId(db);
  let sql = `SELECT
      c.id, c.name,
      d.id AS division_id,
      d.name AS division_name,
      v.name AS venue_name,
      c.competition_code IS NOT NULL AND c.status = 'known' AS is_published
    FROM pyramid_season_memberships psm
    JOIN pyramid_season_divisions psd ON psd.id = psm.season_division_id
    JOIN pyramid_divisions d ON d.id = psd.division_id
    JOIN clubs c ON c.id = psm.club_id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE psm.season_id = ?`;
  const params: (string | number)[] = [seasonId];
  if (divisionId !== undefined) {
    sql += ` AND d.id = ?`;
    params.push(divisionId);
  }
  sql += ` ORDER BY d.level, d.name, c.name`;
  const rows = await db.all<{
    id: number; name: string; division_id: number; division_name: string; venue_name: string | null; is_published: number;
  }>(sql, params);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    divisionId: row.division_id,
    divisionName: row.division_name,
    venueName: row.venue_name,
    isPublished: row.is_published === 1
  }));
}

const KNOWN_COMPETITION_MAP: Record<string, string> = {
  "Premier League": "PL",
  "Championship": "ELC",
  "National League": "NL",
  "National League North": "NLN",
  "National League South": "NLS",
  "Northern Premier League Premier Division": "NPL_PREM",
  "Southern Football League Premier Division Central": "SFL_CEN",
  "Southern Football League Premier Division South": "SFL_SOU",
  "Isthmian League Premier Division": "ISM_PREM",
  "Northern Premier League Division One East": "NPL_E",
  "Northern Premier League Division One West": "NPL_W",
  "Southern Football League Division One East": "SFL_E",
  "Southern Football League Division One West": "SFL_W",
  "Isthmian League Division One North": "ISM_N",
  "Isthmian League Division One South Central": "ISM_SC",
  "Isthmian League Division One South East": "ISM_SE",
  "Northern Premier League Division One Midlands": "NPL_M",
};

export function divisionCodeFromName(name: string): string {
  const known = KNOWN_COMPETITION_MAP[name];
  if (known) return known;

  return name
    .toUpperCase()
    .replace(/['']/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 10);
}

export function getKnownCompetitionCodes(): string[] {
  return Array.from(new Set(Object.values(KNOWN_COMPETITION_MAP)));
}

