import { findAmbiguousAliases } from "@/lib/db/clubMapping";
import type { AppDatabase } from "@/lib/db/adapter";

export type DataQualitySeverity = "error" | "warning" | "info";

export interface DataQualityIssue {
  id: string;
  severity: DataQualitySeverity;
  issueType: string;
  category: string;
  entity: string;
  entityId: number;
  summary: string;
  actionUrl: string | null;
}

async function clubsWithNoPrimaryVenue(db: AppDatabase): Promise<DataQualityIssue[]> {
  const rows = await db.all<{ id: number; name: string }>(
    `SELECT c.id, c.name
     FROM clubs c
     JOIN division_assignments da ON da.club_id = c.id
     WHERE NOT EXISTS (
       SELECT 1 FROM club_venue_assignments cva
       WHERE cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
     )
     ORDER BY c.name`
  );

  return rows.map((r) => ({
    id: `no-primary-venue-${r.id}`,
    severity: "error",
    issueType: "No primary venue",
    category: "Club",
    entity: r.name,
    entityId: r.id,
    summary: "Club has no current primary venue assigned.",
    actionUrl: `/admin/clubs/${r.id}`
  }));
}

async function venuesWithBlankPostcode(db: AppDatabase): Promise<DataQualityIssue[]> {
  const rows = await db.all<{ id: number; name: string }>(
    `SELECT id, name FROM venues WHERE postcode IS NULL OR postcode = '' ORDER BY name`
  );

  return rows.map((r) => ({
    id: `blank-postcode-${r.id}`,
    severity: "warning",
    issueType: "Blank venue postcode",
    category: "Venue",
    entity: r.name,
    entityId: r.id,
    summary: "Venue postcode is blank.",
    actionUrl: `/admin/venues/${r.id}`
  }));
}

async function venuesWithInvalidCoordinates(db: AppDatabase): Promise<DataQualityIssue[]> {
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
    severity: "error",
    issueType: "Invalid venue coordinates",
    category: "Venue",
    entity: r.name,
    entityId: r.id,
    summary: `Venue has unusable coordinates (${r.latitude ?? "null"}, ${r.longitude ?? "null"}).`,
    actionUrl: `/admin/venues/${r.id}`
  }));
}

async function venuesImpreciseCoords(db: AppDatabase): Promise<DataQualityIssue[]> {
  const rows = await db.all<{ id: number; name: string; precision: string | null }>(
    `SELECT id, name, coordinate_precision AS precision
     FROM venues
     WHERE coordinate_precision IS NULL
        OR coordinate_precision = 'unknown'
     ORDER BY name`
  );

  return rows.map((r) => ({
    id: `imprecise-coords-${r.id}`,
    severity: "warning",
    issueType: "Imprecise venue coordinates",
    category: "Venue",
    entity: r.name,
    entityId: r.id,
    summary: `Venue coordinates are ${r.precision ?? "unknown"}.`,
    actionUrl: `/admin/venues/${r.id}`
  }));
}

async function duplicateClubAliases(db: AppDatabase): Promise<DataQualityIssue[]> {
  const groups = await findAmbiguousAliases(db);

  return groups.map((g) => ({
    id: `duplicate-alias-${g.normalizedAlias}-${g.competitionCode ?? "unscoped"}`,
    severity: "warning",
    issueType: "Duplicate club alias",
    category: "Alias",
    entity: `${g.normalizedAlias} (${g.competitionCode ?? "unscoped"})`,
    entityId: 0,
    summary: `Alias "${g.normalizedAlias}" maps to ${g.clubs.length} clubs: ${g.clubs.map((c) => c.clubName).join(", ")}.`,
    actionUrl: null
  }));
}

async function clubsWithoutTicketUrl(db: AppDatabase): Promise<DataQualityIssue[]> {
  const rows = await db.all<{ id: number; name: string }>(
    `SELECT c.id, c.name
     FROM clubs c
     WHERE c.generic_ticket_url IS NULL
     ORDER BY c.name`
  );

  return rows.map((r) => ({
    id: `no-ticket-url-${r.id}`,
    severity: "info",
    issueType: "No ticket URL",
    category: "Club",
    entity: r.name,
    entityId: r.id,
    summary: "Public club has no ticket URL.",
    actionUrl: null
  }));
}

async function divisionsOverMaxSize(db: AppDatabase): Promise<DataQualityIssue[]> {
  const rows = await db.all<{ id: number; name: string; club_count: number; max_size: number }>(
    `SELECT d.id, d.name, COUNT(da.id) AS club_count, d.max_size
     FROM pyramid_divisions d
     JOIN division_assignments da ON da.division_id = d.id
     GROUP BY d.id
     HAVING club_count > d.max_size
     ORDER BY d.name`
  );

  return rows.map((r) => ({
    id: `division-over-size-${r.id}`,
    severity: "warning",
    issueType: "Division over max size",
    category: "Division",
    entity: r.name,
    entityId: r.id,
    summary: `Division has ${r.club_count} clubs but max size is ${r.max_size}.`,
    actionUrl: null
  }));
}

async function divisionsWithoutCompetitionMapping(db: AppDatabase): Promise<DataQualityIssue[]> {
  const rows = await db.all<{ id: number; name: string }>(
    `SELECT d.id, d.name
     FROM pyramid_divisions d
     JOIN division_assignments da ON da.division_id = d.id
     LEFT JOIN division_competition_mappings dcm ON dcm.division_id = d.id
     WHERE dcm.id IS NULL
     GROUP BY d.id
     ORDER BY d.name`
  );

  return rows.map((r) => ({
    id: `division-no-mapping-${r.id}`,
    severity: "warning",
    issueType: "Division not published",
    category: "Division",
    entity: r.name,
    entityId: r.id,
    summary: "Populated division has no competition mapping.",
    actionUrl: `/admin/publish`
  }));
}

async function fixturesMissingSourceUrl(db: AppDatabase): Promise<DataQualityIssue[]> {
  const rows = await db.all<{ id: number; source: string; source_id: string }>(
    `SELECT id, source, source_id
     FROM fixtures
     WHERE source_url IS NULL
       AND is_demo_data = 0
     ORDER BY id
     LIMIT 100`
  );

  return rows.map((r) => ({
    id: `fixture-no-source-url-${r.id}`,
    severity: "info",
    issueType: "Fixture missing source URL",
    category: "Fixture",
    entity: `${r.source}/${r.source_id}`,
    entityId: r.id,
    summary: "Fixture has no source URL.",
    actionUrl: null
  }));
}

async function duplicateFixtures(db: AppDatabase): Promise<DataQualityIssue[]> {
  const rows = await db.all<{
    first_fixture_id: number;
    fixture_count: number;
    fixture_ids: string;
    competition_code: string;
    season_label: string | null;
    fixture_date: string | null;
    home_name: string;
    away_name: string;
  }>(
    `WITH fixture_identity AS (
       SELECT
         f.id,
         f.competition_code,
         f.season_label,
         f.fixture_date,
         CASE
           WHEN f.home_one_off = 1 THEN 'one-off:' || lower(trim(f.home_one_off_name))
           ELSE 'club:' || f.home_club_id
         END AS home_key,
         CASE
           WHEN f.away_one_off = 1 THEN 'one-off:' || lower(trim(f.away_one_off_name))
           ELSE 'club:' || f.away_club_id
         END AS away_key,
         COALESCE(NULLIF(trim(f.home_one_off_name), ''), hc.name, 'Unknown home') AS home_name,
         COALESCE(NULLIF(trim(f.away_one_off_name), ''), ac.name, 'Unknown away') AS away_name
       FROM fixtures f
       LEFT JOIN clubs hc ON hc.id = f.home_club_id
       LEFT JOIN clubs ac ON ac.id = f.away_club_id
     )
     SELECT
       MIN(id) AS first_fixture_id,
       COUNT(*) AS fixture_count,
       group_concat(id, ', ') AS fixture_ids,
       competition_code,
       season_label,
       fixture_date,
       MIN(home_name) AS home_name,
       MIN(away_name) AS away_name
     FROM fixture_identity
     GROUP BY competition_code, season_label, fixture_date, home_key, away_key
     HAVING COUNT(*) > 1
     ORDER BY first_fixture_id
     LIMIT 100`
  );

  return rows.map((r) => ({
    id: `duplicate-fixture-${r.first_fixture_id}`,
    severity: "warning",
    issueType: "Duplicate fixture",
    category: "Fixture",
    entity: `${r.home_name} v ${r.away_name}`,
    entityId: r.first_fixture_id,
    summary: `${r.fixture_count} fixtures share ${r.competition_code} identity for ${r.season_label ?? "unknown season"}${r.fixture_date ? ` on ${r.fixture_date}` : ""}: ${r.fixture_ids}.`,
    actionUrl: null
  }));
}

async function fixturesWithAssumedKickoff(db: AppDatabase): Promise<DataQualityIssue[]> {
  const rows = await db.all<{ id: number; source: string; source_id: string }>(
    `SELECT id, source, source_id
     FROM fixtures
     WHERE kickoff_time_status = 'assumed'
       AND is_demo_data = 0
     ORDER BY id
     LIMIT 100`
  );

  return rows.map((r) => ({
    id: `fixture-assumed-kickoff-${r.id}`,
    severity: "warning",
    issueType: "Fixture assumed kickoff",
    category: "Fixture",
    entity: `${r.source}/${r.source_id}`,
    entityId: r.id,
    summary: "Fixture has an assumed kickoff time.",
    actionUrl: null
  }));
}

async function fixturesMissingTicketInfo(db: AppDatabase): Promise<DataQualityIssue[]> {
  const rows = await db.all<{ id: number; source: string; source_id: string }>(
    `SELECT f.id, f.source, f.source_id
     FROM fixtures f
     LEFT JOIN club_ticket_prices ctp ON ctp.club_id = f.home_club_id
     LEFT JOIN fixture_ticket_price_overrides ftpo ON ftpo.fixture_id = f.id
     WHERE ctp.club_id IS NULL AND ftpo.fixture_id IS NULL
       AND f.is_demo_data = 0
     ORDER BY f.id
     LIMIT 100`
  );

  return rows.map((r) => ({
    id: `fixture-no-ticket-${r.id}`,
    severity: "info",
    issueType: "Fixture missing ticket info",
    category: "Fixture",
    entity: `${r.source}/${r.source_id}`,
    entityId: r.id,
    summary: "Fixture has no ticket price information.",
    actionUrl: null
  }));
}

async function fixturesHiddenByLocation(db: AppDatabase): Promise<DataQualityIssue[]> {
  const rows = await db.all<{ id: number; source: string; source_id: string; venue_name: string }>(
    `SELECT f.id, f.source, f.source_id, v.name AS venue_name
     FROM fixtures f
     JOIN venues v ON v.id = f.venue_id
     WHERE (v.latitude IS NULL OR v.longitude IS NULL
        OR v.latitude < -90 OR v.latitude > 90
        OR v.longitude < -180 OR v.longitude > 180)
       AND f.is_demo_data = 0
     ORDER BY f.id
     LIMIT 100`
  );

  return rows.map((r) => ({
    id: `fixture-hidden-location-${r.id}`,
    severity: "error",
    issueType: "Fixture hidden by bad coordinates",
    category: "Fixture",
    entity: `${r.source}/${r.source_id}`,
    entityId: r.id,
    summary: `Fixture at "${r.venue_name}" has unusable venue coordinates.`,
    actionUrl: null
  }));
}

export async function runDataQualityChecks(db: AppDatabase): Promise<DataQualityIssue[]> {
  const checks = [
    clubsWithNoPrimaryVenue(db),
    venuesWithBlankPostcode(db),
    venuesWithInvalidCoordinates(db),
    venuesImpreciseCoords(db),
    duplicateClubAliases(db),
    clubsWithoutTicketUrl(db),
    divisionsOverMaxSize(db),
    divisionsWithoutCompetitionMapping(db),
    fixturesMissingSourceUrl(db),
    duplicateFixtures(db),
    fixturesWithAssumedKickoff(db),
    fixturesMissingTicketInfo(db),
    fixturesHiddenByLocation(db),
  ];

  const results = await Promise.all(checks);
  return results.flat().sort((a, b) => {
    const order = ["error", "warning", "info"];
    const sevDiff = order.indexOf(a.severity) - order.indexOf(b.severity);
    if (sevDiff !== 0) return sevDiff;
    const typeDiff = a.issueType.localeCompare(b.issueType);
    if (typeDiff !== 0) return typeDiff;
    return a.category.localeCompare(b.category) || a.summary.localeCompare(b.summary);
  });
}
