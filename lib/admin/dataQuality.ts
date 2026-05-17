import { getDatabase } from "@/lib/db/client";
import { getLatestSeasonId } from "@/lib/admin/clubs";

export type DataQualitySeverity = "error" | "warning" | "info";

export interface DataQualityIssue {
  id: string;
  severity: DataQualitySeverity;
  category: string;
  entity: string;
  entityId: number;
  summary: string;
  actionUrl: string | null;
}

async function clubsWithNoPrimaryVenue(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();
  const rows = await db.all<{ id: number; name: string }>(
    `SELECT pc.id, pc.name
     FROM pyramid_season_memberships psm
     JOIN pyramid_clubs pc ON pc.id = psm.club_id
     LEFT JOIN club_venue_assignments cva
       ON cva.club_id = pc.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
     WHERE cva.id IS NULL
     GROUP BY pc.id
     ORDER BY pc.name`
  );

  return rows.map((r) => ({
    id: `no-primary-venue-${r.id}`,
    severity: "error" as const,
    category: "Club",
    entity: r.name,
    entityId: r.id,
    summary: "Club has no current primary venue assigned.",
    actionUrl: `/admin/clubs/${r.id}`
  }));
}

async function mappedClubsMissingVenueData(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();
  const rows = await db.all<{ club_id: number; club_name: string; venue_id: number | null }>(
    `SELECT cm.club_id, c.name AS club_name, c.venue_id
     FROM club_mappings cm
     JOIN pyramid_clubs pc ON pc.id = cm.pyramid_club_id
     JOIN clubs c ON c.id = cm.club_id
     LEFT JOIN venues v ON v.id = c.venue_id
     WHERE c.venue_id IS NULL
        OR v.latitude IS NULL
        OR v.longitude IS NULL
        OR v.latitude < -90 OR v.latitude > 90
        OR v.longitude < -180 OR v.longitude > 180`
  );

  return rows.map((r) => ({
    id: `mapped-club-no-venue-${r.club_id}`,
    severity: "error" as const,
    category: "Mapped Club",
    entity: r.club_name,
    entityId: r.club_id,
    summary: "Mapped club is missing required venue data.",
    actionUrl: `/admin/clubs/${r.club_id}`
  }));
}

async function venuesWithBlankPostcode(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();
  const rows = await db.all<{ id: number; name: string }>(
    `SELECT id, name FROM venues WHERE postcode IS NULL OR postcode = '' ORDER BY name`
  );

  return rows.map((r) => ({
    id: `blank-postcode-${r.id}`,
    severity: "warning" as const,
    category: "Venue",
    entity: r.name,
    entityId: r.id,
    summary: "Venue postcode is blank.",
    actionUrl: `/admin/venues/${r.id}`
  }));
}

async function venuesWithInvalidCoordinates(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();
  const rows = await db.all<{ id: number; name: string; latitude: number; longitude: number }>(
    `SELECT id, name, latitude, longitude
     FROM venues
     WHERE latitude IS NULL OR longitude IS NULL
        OR latitude < -90 OR latitude > 90
        OR longitude < -180 OR longitude > 180
     ORDER BY name`
  );

  return rows.map((r) => ({
    id: `invalid-coords-${r.id}`,
    severity: "error" as const,
    category: "Venue",
    entity: r.name,
    entityId: r.id,
    summary: `Venue has unusable coordinates (${r.latitude ?? "null"}, ${r.longitude ?? "null"}).`,
    actionUrl: `/admin/venues/${r.id}`
  }));
}

async function venuesImpreciseCoords(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();
  const rows = await db.all<{ id: number; name: string; precision: string | null }>(
    `SELECT id, name, coordinate_precision AS precision
     FROM venues
     WHERE coordinate_precision IN ('ground_approximate', 'unknown')
        OR coordinate_precision IS NULL
     ORDER BY name`
  );

  return rows.map((r) => ({
    id: `imprecise-coords-${r.id}`,
    severity: "warning" as const,
    category: "Venue",
    entity: r.name,
    entityId: r.id,
    summary: `Venue coordinates are ${r.precision ?? "unknown"}.`,
    actionUrl: `/admin/venues/${r.id}`
  }));
}

async function duplicateClubAliases(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();
  const rows = await db.all<{ normalized_alias: string; club_count: number }>(
    `SELECT normalized_alias, COUNT(DISTINCT club_id) AS club_count
     FROM club_aliases
     WHERE retired_at IS NULL
     GROUP BY normalized_alias
     HAVING COUNT(DISTINCT club_id) > 1
     ORDER BY normalized_alias`
  );

  return rows.map((r) => ({
    id: `duplicate-alias-${r.normalized_alias}`,
    severity: "warning" as const,
    category: "Alias",
    entity: r.normalized_alias,
    entityId: 0,
    summary: `Alias "${r.normalized_alias}" maps to ${r.club_count} different clubs.`,
    actionUrl: null
  }));
}

async function clubsWithoutTicketUrl(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();
  const rows = await db.all<{ id: number; name: string }>(
    `SELECT c.id, c.name
     FROM clubs c
     WHERE c.generic_ticket_url IS NULL
     ORDER BY c.name`
  );

  return rows.map((r) => ({
    id: `no-ticket-url-${r.id}`,
    severity: "info" as const,
    category: "Club",
    entity: r.name,
    entityId: r.id,
    summary: "Public club has no ticket URL.",
    actionUrl: null
  }));
}

async function divisionsOverMaxSize(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();
  let seasonId: number;
  try {
    seasonId = await getLatestSeasonId(db);
  } catch {
    return [];
  }

  const rows = await db.all<{ id: number; name: string; club_count: number; max_size: number }>(
    `SELECT d.id, d.name, COUNT(psm.id) AS club_count, d.max_size
     FROM pyramid_season_divisions psd
     JOIN pyramid_divisions d ON d.id = psd.division_id
     JOIN pyramid_season_memberships psm ON psm.season_division_id = psd.id
     WHERE psd.season_id = ?
     GROUP BY d.id
     HAVING club_count > d.max_size
     ORDER BY d.name`,
    [seasonId]
  );

  return rows.map((r) => ({
    id: `division-over-size-${r.id}`,
    severity: "warning" as const,
    category: "Division",
    entity: r.name,
    entityId: r.id,
    summary: `Division has ${r.club_count} clubs but max size is ${r.max_size}.`,
    actionUrl: null
  }));
}

async function divisionsWithoutCompetitionMapping(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();
  let seasonId: number;
  try {
    seasonId = await getLatestSeasonId(db);
  } catch {
    return [];
  }

  const rows = await db.all<{ id: number; name: string }>(
    `SELECT d.id, d.name
     FROM pyramid_season_divisions psd
     JOIN pyramid_divisions d ON d.id = psd.division_id
     JOIN pyramid_season_memberships psm ON psm.season_division_id = psd.id
     LEFT JOIN division_competition_mappings dcm ON dcm.division_id = d.id
     WHERE psd.season_id = ?
       AND dcm.id IS NULL
     GROUP BY d.id
     ORDER BY d.name`,
    [seasonId]
  );

  return rows.map((r) => ({
    id: `division-no-mapping-${r.id}`,
    severity: "warning" as const,
    category: "Division",
    entity: String(r.name),
    entityId: r.id,
    summary: "Populated division has no competition mapping.",
    actionUrl: `/admin/publish`
  }));
}

async function clubsWithoutPublicMapping(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();
  let seasonId: number;
  try {
    seasonId = await getLatestSeasonId(db);
  } catch {
    return [];
  }

  const rows = await db.all<{ id: number; name: string }>(
    `SELECT pc.id, pc.name
     FROM pyramid_season_memberships psm
     JOIN pyramid_clubs pc ON pc.id = psm.club_id
     LEFT JOIN club_mappings cm ON cm.pyramid_club_id = pc.id
     WHERE psm.season_id = ?
       AND cm.id IS NULL
     GROUP BY pc.id
     ORDER BY pc.name`,
    [seasonId]
  );

  return rows.map((r) => ({
    id: `club-no-mapping-${r.id}`,
    severity: "warning" as const,
    category: "Club",
    entity: r.name,
    entityId: r.id,
    summary: "Populated club has no public mapping.",
    actionUrl: `/admin/publish`
  }));
}

async function fixturesMissingSourceUrl(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();

  const rows = await db.all<{ id: number; source: string; source_id: string }>(
    `SELECT id, source, source_id
     FROM fixtures
     WHERE source_url IS NULL
     ORDER BY id
     LIMIT 100`
  );

  return rows.map((r) => ({
    id: `fixture-no-source-url-${r.id}`,
    severity: "info" as const,
    category: "Fixture",
    entity: `${r.source}/${r.source_id}`,
    entityId: r.id,
    summary: "Fixture has no source URL.",
    actionUrl: null
  }));
}

async function fixturesWithAssumedKickoff(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();

  const rows = await db.all<{ id: number; source: string; source_id: string }>(
    `SELECT id, source, source_id
     FROM fixtures
     WHERE kickoff_time_status = 'assumed'
     ORDER BY id
     LIMIT 100`
  );

  return rows.map((r) => ({
    id: `fixture-assumed-kickoff-${r.id}`,
    severity: "warning" as const,
    category: "Fixture",
    entity: `${r.source}/${r.source_id}`,
    entityId: r.id,
    summary: "Fixture has an assumed kickoff time.",
    actionUrl: null
  }));
}

async function fixturesMissingTicketInfo(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();

  const rows = await db.all<{ id: number; source: string; source_id: string }>(
    `SELECT f.id, f.source, f.source_id
     FROM fixtures f
     LEFT JOIN club_ticket_prices ctp ON ctp.club_id = f.home_club_id
     LEFT JOIN fixture_ticket_price_overrides ftpo ON ftpo.fixture_id = f.id
     WHERE ctp.club_id IS NULL AND ftpo.fixture_id IS NULL
     ORDER BY f.id
     LIMIT 100`
  );

  return rows.map((r) => ({
    id: `fixture-no-ticket-${r.id}`,
    severity: "info" as const,
    category: "Fixture",
    entity: `${r.source}/${r.source_id}`,
    entityId: r.id,
    summary: "Fixture has no ticket price information.",
    actionUrl: null
  }));
}

async function fixturesHiddenByLocation(): Promise<DataQualityIssue[]> {
  const db = await getDatabase();

  const rows = await db.all<{ id: number; source: string; source_id: string; venue_name: string }>(
    `SELECT f.id, f.source, f.source_id, v.name AS venue_name
     FROM fixtures f
     JOIN venues v ON v.id = f.venue_id
     WHERE v.latitude IS NULL OR v.longitude IS NULL
        OR v.latitude < -90 OR v.latitude > 90
        OR v.longitude < -180 OR v.longitude > 180
     ORDER BY f.id
     LIMIT 100`
  );

  return rows.map((r) => ({
    id: `fixture-hidden-location-${r.id}`,
    severity: "error" as const,
    category: "Fixture",
    entity: `${r.source}/${r.source_id}`,
    entityId: r.id,
    summary: `Fixture at "${r.venue_name}" has unusable venue coordinates.`,
    actionUrl: null
  }));
}

export async function runDataQualityChecks(): Promise<DataQualityIssue[]> {
  const checks = [
    clubsWithNoPrimaryVenue(),
    mappedClubsMissingVenueData(),
    venuesWithBlankPostcode(),
    venuesWithInvalidCoordinates(),
    venuesImpreciseCoords(),
    duplicateClubAliases(),
    clubsWithoutTicketUrl(),
    divisionsOverMaxSize(),
    divisionsWithoutCompetitionMapping(),
    clubsWithoutPublicMapping(),
    fixturesMissingSourceUrl(),
    fixturesWithAssumedKickoff(),
    fixturesMissingTicketInfo(),
    fixturesHiddenByLocation(),
  ];

  const results = await Promise.all(checks);
  return results.flat().sort((a, b) => {
    const order = ["error", "warning", "info"];
    const sevDiff = order.indexOf(a.severity) - order.indexOf(b.severity);
    if (sevDiff !== 0) return sevDiff;
    return a.category.localeCompare(b.category) || a.summary.localeCompare(b.summary);
  });
}
