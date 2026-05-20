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
  division_id: number;
  division_name: string;
  division_level: number;
  clubs: AdminClubRow[];
}

export interface AdminClubListData {
  seasonLabel: string;
  divisions: AdminDivisionGroup[];
  unassignedClubs: AdminClubRow[];
}

interface ClubDivisionRow {
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

export async function getAdminClubList(db: AppDatabase): Promise<AdminClubListData> {
  const season = await db.get<{ season_label: string }>(
    "SELECT season_label FROM pyramid_seasons ORDER BY id DESC LIMIT 1"
  );

  const rows = await db.all<ClubDivisionRow>(
    `SELECT
      d.id AS division_id,
      d.name AS division_name,
      d.level AS division_level,
      c.id AS club_id,
      c.name AS club_name,
      c.status AS club_status,
      v.id AS venue_id,
      v.name AS venue_name,
      v.postcode AS venue_postcode
    FROM division_assignments da
    JOIN pyramid_divisions d ON d.id = da.division_id
    JOIN clubs c ON c.id = da.club_id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    ORDER BY d.level, d.name, c.name`
  );

  const unassignedRows = await db.all<AdminClubRow>(
    `SELECT c.id AS club_id, c.name AS club_name, c.status AS club_status,
      v.id AS venue_id, v.name AS venue_name, v.postcode AS venue_postcode
    FROM clubs c
    LEFT JOIN division_assignments da ON da.club_id = c.id
    LEFT JOIN club_venue_assignments cva ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE da.id IS NULL
    ORDER BY c.name`
  );

  const divisions = new Map<number, AdminDivisionGroup>();

  for (const row of rows) {
    let group = divisions.get(row.division_id);

    if (!group) {
      group = {
        division_id: row.division_id,
        division_name: row.division_name,
        division_level: row.division_level,
        clubs: []
      };
      divisions.set(row.division_id, group);
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
    seasonLabel: season?.season_label ?? "",
    divisions: Array.from(divisions.values()),
    unassignedClubs: unassignedRows
  };
}

export async function getAdminClubDetail(db: AppDatabase, clubId: number): Promise<AdminClubDetailData | null> {
  const season = await db.get<{ season_label: string }>(
    "SELECT season_label FROM pyramid_seasons ORDER BY id DESC LIMIT 1"
  );

  const clubRow = await db.get<ClubDetailRow>(
    `SELECT
      c.id, c.name, c.aliases, c.status, c.source_url, c.verified_at,
      d.id AS division_id, d.name AS division_name, d.level AS division_level,
      v.id AS venue_id, v.name AS venue_name, v.postcode AS venue_postcode,
      v.latitude, v.longitude, v.is_approximate
    FROM clubs c
    LEFT JOIN division_assignments da ON da.club_id = c.id
    LEFT JOIN pyramid_divisions d ON d.id = da.division_id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE c.id = ?`,
    [clubId]
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
    season: clubRow.division_id
      ? {
          label: season?.season_label ?? "",
          division_id: clubRow.division_id,
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

export async function updateAdminClub(db: AppDatabase, clubId: number, input: AdminClubUpdateInput): Promise<void> {
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

export async function getPublishableDivisions(db: AppDatabase): Promise<PublishableDivision[]> {
  const rows = await db.all<{
    id: number; name: string; level: number; competition_code: string | null;
  }>(
    `SELECT d.id, d.name, d.level, dcm.competition_code
    FROM pyramid_divisions d
    LEFT JOIN division_competition_mappings dcm ON dcm.division_id = d.id
    WHERE EXISTS (
      SELECT 1 FROM division_assignments da WHERE da.division_id = d.id
    )
    ORDER BY d.level, d.name`
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    isPublished: row.competition_code !== null,
    competitionCode: row.competition_code
  }));
}

export async function getPublishableClubs(db: AppDatabase, divisionId: number): Promise<PublishableClub[]> {
  const rows = await db.all<{
    id: number; name: string; division_id: number; division_name: string; venue_name: string | null; is_published: number;
  }>(
    `SELECT c.id, c.name, d.id AS division_id, d.name AS division_name, v.name AS venue_name,
      c.competition_code IS NOT NULL AND c.status = 'known' AS is_published
    FROM division_assignments da
    JOIN pyramid_divisions d ON d.id = da.division_id
    JOIN clubs c ON c.id = da.club_id
    LEFT JOIN club_venue_assignments cva ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE d.id = ?
    ORDER BY d.level, d.name, c.name`,
    [divisionId]
  );
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
  "North West Counties League Premier Division": "NWCF_P",
  "North West Counties League Division One North": "NWCF_1N",
  "North West Counties League Division One South": "NWCF_1S",
  "Combined Counties League Premier Division North": "CC_PN",
  "Combined Counties League Premier Division South": "CC_PS",
  "Combined Counties League Division One": "CC_D1",
  "Eastern Counties League Premier Division": "ECL_P",
  "Eastern Counties League Division One North": "ECL_1N",
  "Eastern Counties League Division One South": "ECL_1S",
  "Essex Senior League": "ESL",
  "Hellenic League Premier Division": "HLL_P",
  "Hellenic League Division One": "HLL_D1",
  "Midland League Premier Division": "MID_P",
  "Midland League Division One": "MID_D1",
  "Northern Counties East League Premier Division": "NCE_P",
  "Northern Counties East League Division One": "NCE_D1",
  "Northern League Division One": "NLG_D1",
  "Northern League Division Two": "NLG_D2",
  "Southern Counties East League Premier Division": "SCE_P",
  "Southern Counties East League Division One": "SCE_D1",
  "Southern Combination League Premier Division": "SCB_P",
  "Southern Combination League Division One": "SCB_D1",
  "Spartan South Midlands League Premier Division": "SSM_P",
  "Spartan South Midlands League Division One": "SSM_D1",
  "United Counties League Premier Division North": "UCL_PN",
  "United Counties League Premier Division South": "UCL_PS",
  "United Counties League Division One": "UCL_D1",
  "Wessex League Premier Division": "WEX_P",
  "Wessex League Division One": "WEX_D1",
  "Western League Premier Division": "WES_P",
  "Western League Division One": "WES_D1",
  "South West Peninsula League Premier Division East": "SWP_PE",
  "South West Peninsula League Premier Division West": "SWP_PW",
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

export interface CompetitionClubRow {
  id: number;
  name: string;
  status: string;
  venueName: string | null;
  hasTicketUrl: boolean;
  isPublished: boolean;
}

export interface CompetitionSummary {
  id: number | null;
  name: string;
  level: number;
  code: string | null;
  isPublished: boolean;
  totalClubs: number;
  missingVenueCount: number;
  missingTicketUrlCount: number;
  clubs: CompetitionClubRow[];
}

export interface TierGroup {
  tier: number;
  competitions: CompetitionSummary[];
}

export interface AllCompetitionsData {
  seasonLabel: string;
  tiers: TierGroup[];
  unassignedClubs: Array<{
    id: number;
    name: string;
    status: string;
    venueName: string | null;
  }>;
}

export async function getAllCompetitionsWithClubs(db: AppDatabase): Promise<AllCompetitionsData> {
  const season = await db.get<{ season_label: string }>(
    "SELECT season_label FROM pyramid_seasons ORDER BY id DESC LIMIT 1"
  );

  const rows = await db.all<{
    competition_code: string;
    competition_name: string;
    competition_tier: number;
    division_id: number | null;
    has_mapping: number;
    club_id: number | null;
    club_name: string | null;
    club_status: string | null;
    club_competition_code: string | null;
    venue_name: string | null;
    generic_ticket_url: string | null;
  }>(
    `SELECT
      c.code AS competition_code,
      c.name AS competition_name,
      c.tier AS competition_tier,
      d.id AS division_id,
      CASE WHEN dcm.id IS NOT NULL THEN 1 ELSE 0 END AS has_mapping,
      cl.id AS club_id,
      cl.name AS club_name,
      cl.status AS club_status,
      cl.competition_code AS club_competition_code,
      v.name AS venue_name,
      cl.generic_ticket_url
    FROM competitions c
    LEFT JOIN division_competition_mappings dcm ON dcm.competition_code = c.code
    LEFT JOIN pyramid_divisions d ON d.id = dcm.division_id
    LEFT JOIN division_assignments da ON da.division_id = d.id
    LEFT JOIN clubs cl ON cl.id = da.club_id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = cl.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE c.kind != 'friendly'
    ORDER BY c.tier, c.name, cl.name`
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
    LEFT JOIN club_venue_assignments cva ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    WHERE da.id IS NULL
    ORDER BY c.name`
  );

  const compMap = new Map<string, {
    id: number | null;
    name: string;
    level: number;
    code: string;
    isPublished: boolean;
    clubs: Array<{
      id: number;
      name: string;
      status: string;
      venueName: string | null;
      hasTicketUrl: boolean;
      isPublished: boolean;
    }>;
  }>();

  for (const row of rows) {
    let comp = compMap.get(row.competition_code);
    if (!comp) {
      comp = {
        id: row.division_id,
        name: row.competition_name,
        level: row.competition_tier,
        code: row.competition_code,
        isPublished: row.has_mapping === 1,
        clubs: [],
      };
      compMap.set(row.competition_code, comp);
    }
    if (row.club_id !== null) {
      comp.clubs.push({
        id: row.club_id,
        name: row.club_name!,
        status: row.club_status!,
        venueName: row.venue_name,
        hasTicketUrl: !!row.generic_ticket_url,
        isPublished: row.club_competition_code !== null && row.club_status === "known",
      });
    }
  }

  const summaries: CompetitionSummary[] = Array.from(compMap.values()).map((comp) => {
    const missingVenue = comp.clubs.filter((c) => !c.venueName).length;
    const missingTicket = comp.clubs.filter((c) => !c.hasTicketUrl).length;
    return {
      id: comp.id,
      name: comp.name,
      level: comp.level,
      code: comp.isPublished ? comp.code : null,
      isPublished: comp.isPublished,
      totalClubs: comp.clubs.length,
      missingVenueCount: missingVenue,
      missingTicketUrlCount: missingTicket,
      clubs: comp.clubs,
    };
  });

  const tierMap = new Map<number, CompetitionSummary[]>();
  for (const s of summaries) {
    let tier = tierMap.get(s.level);
    if (!tier) {
      tier = [];
      tierMap.set(s.level, tier);
    }
    tier.push(s);
  }

  const tiers: TierGroup[] = Array.from(tierMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([tier, competitions]) => ({ tier, competitions }));

  return {
    seasonLabel: season?.season_label ?? "",
    tiers,
    unassignedClubs: unassignedRows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      venueName: r.venue_name,
    })),
  };
}

