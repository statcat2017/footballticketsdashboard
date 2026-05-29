import { createD1AppDatabase, type AppDatabase, type D1RootDatabaseLike, type D1PreparedStatement } from "./adapter.ts";
import { schemaSql } from "./schema.ts";
import {
  CLUB_VENUE_ASSIGNMENTS,
  computeDivisionDisplayOrder,
  computeEdgeAllocationType,
  MEN_PYRAMID_CLUBS,
  MEN_PYRAMID_DIVISIONS,
  MEN_PYRAMID_EDGES,
  MEN_PYRAMID_MEMBERSHIPS,
  MEN_PYRAMID_SEASON_DIVISIONS,
  MEN_PYRAMID_SEASONS,
  MEN_PYRAMID_TEMPLATE
} from "./pyramid.ts";
import { SEED_DATA } from "./seed-data-static.ts";
export { SEED_DATA };

export function createD1Database(binding: D1RootDatabaseLike): AppDatabase {
  return createD1AppDatabase(binding);
}

export async function initializeD1Database(binding: D1RootDatabaseLike): Promise<void> {
  const db = createD1Database(binding);

  await db.exec(schemaSql);

  // Idempotent migration for existing D1 databases: add is_approximate if missing
  const colCheck = await db.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM pragma_table_info('venues') WHERE name = 'is_approximate'"
  );
  if (!colCheck || colCheck.count === 0) {
    await db.exec("ALTER TABLE venues ADD COLUMN is_approximate INTEGER NOT NULL DEFAULT 0 CHECK (is_approximate IN (0, 1))");
  }

  const divisionDisplayOrder = computeDivisionDisplayOrder();
  const edgeAllocationType = computeEdgeAllocationType();
  const latestPyramidSeasonId = Math.max(...MEN_PYRAMID_SEASONS.map((s) => s.id));
  const statements: D1PreparedStatement[] = [];
  const add = (sql: string, params: Array<string | number | null>) => {
    statements.push(binding.prepare(sql).bind(...params));
  };

  add(
    "INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET code = excluded.code, name = excluded.name, sport = excluded.sport, status = excluded.status",
    [MEN_PYRAMID_TEMPLATE.id, MEN_PYRAMID_TEMPLATE.code, MEN_PYRAMID_TEMPLATE.name, MEN_PYRAMID_TEMPLATE.sport, MEN_PYRAMID_TEMPLATE.status]
  );

  for (const division of MEN_PYRAMID_DIVISIONS) {
    add(
      "INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size, display_order) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET template_id = excluded.template_id, code = excluded.code, name = excluded.name, level = excluded.level, max_size = excluded.max_size, display_order = excluded.display_order",
      [division.id, division.template_id, division.code, division.name, division.level, division.max_size, divisionDisplayOrder.get(division.id) ?? null]
    );
  }

  for (const edge of MEN_PYRAMID_EDGES) {
    add(
      "INSERT INTO pyramid_edges (id, from_division_id, to_division_id, movement_type, allocation_type) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET from_division_id = excluded.from_division_id, to_division_id = excluded.to_division_id, movement_type = excluded.movement_type, allocation_type = excluded.allocation_type",
      [edge.id, edge.from_division_id, edge.to_division_id, edge.movement_type, edgeAllocationType.get(edge.id) ?? "allocation_dependent"]
    );
  }

  for (const season of MEN_PYRAMID_SEASONS) {
    add(
      "INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET template_id = excluded.template_id, season_label = excluded.season_label",
      [season.id, season.template_id, season.season_label]
    );
  }

  for (const c of SEED_DATA.competitions) {
    add(
      "INSERT INTO competitions (code, name, tier, kind) VALUES (?, ?, ?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name, tier = excluded.tier, kind = excluded.kind",
      [c.code, c.name, c.tier, c.kind ?? "league"]
    );
  }

  const DIVISION_COMPETITION_MAPPINGS: Array<{ division_id: number; competition_code: string }> = [
    { division_id: 8, competition_code: "NPLP" },
    { division_id: 9, competition_code: "ILP" },
    { division_id: 10, competition_code: "SLPC" },
    { division_id: 11, competition_code: "SLPS" },
    { division_id: 15, competition_code: "NPL1E" },
    { division_id: 16, competition_code: "NPL1M" },
    { division_id: 17, competition_code: "NPL1W" },
    { division_id: 18, competition_code: "IL1N" },
    { division_id: 19, competition_code: "IL1SC" },
    { division_id: 20, competition_code: "IL1SE" },
    { division_id: 21, competition_code: "SL1C" },
    { division_id: 22, competition_code: "SL1S" },
    { division_id: 23, competition_code: "CC_PN" },
    { division_id: 24, competition_code: "CC_PS" },
    { division_id: 25, competition_code: "EC_PREM" },
    { division_id: 26, competition_code: "ESL" },
    { division_id: 27, competition_code: "HEL_PREM" },
    { division_id: 28, competition_code: "MFL_PREM" },
    { division_id: 29, competition_code: "NCE_PREM" },
    { division_id: 30, competition_code: "NL_D1" },
    { division_id: 31, competition_code: "SCE_PREM" },
    { division_id: 32, competition_code: "SSM_PREM" },
    { division_id: 33, competition_code: "SCO_PREM" },
    { division_id: 34, competition_code: "UCL_PN" },
    { division_id: 35, competition_code: "UCL_PS" },
    { division_id: 36, competition_code: "WES_PREM" },
    { division_id: 37, competition_code: "WESL_PREM" },
  ];
  for (const m of DIVISION_COMPETITION_MAPPINGS) {
    add(
      "INSERT INTO division_competition_mappings (division_id, competition_code) VALUES (?, ?) ON CONFLICT(division_id) DO UPDATE SET competition_code = excluded.competition_code",
      [m.division_id, m.competition_code]
    );
  }

  add(
    "INSERT INTO fixture_seasons (id, label, starts_on, ends_on, is_current) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET label = excluded.label, starts_on = excluded.starts_on, ends_on = excluded.ends_on, is_current = excluded.is_current",
    [1, "2025-26", "2025-08-01", "2026-07-31", 1]
  );

  for (const v of SEED_DATA.venues) {
    add(
      "INSERT INTO venues (id, name, postcode, latitude, longitude, is_approximate) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, postcode = excluded.postcode, latitude = excluded.latitude, longitude = excluded.longitude, is_approximate = excluded.is_approximate",
      [v.id, v.name, v.postcode, v.latitude, v.longitude, v.is_approximate]
    );
  }

  // Build map of existing clubs by name and set of all existing IDs
  // so re-seeds reuse stable IDs and never overwrite manual/admin clubs
  const existingClubByName = new Map<string, number>();
  const existingClubIds = new Set<number>();
  for (const row of await db.all<{ id: number; name: string }>("SELECT id, name FROM clubs")) {
    existingClubByName.set(row.name, row.id);
    existingClubIds.add(row.id);
  }

  // Build ID translation: old pyramid_club_id → new clubs.id
  const pyramidToClubId = new Map<number, number>();
  const maxPyramidId = Math.max(...MEN_PYRAMID_CLUBS.map((c) => c.id));
  const usedClubIds = new Set([...SEED_DATA.clubs.map((c) => c.id), ...existingClubIds]);
  let nextId = Math.max(maxPyramidId, ...usedClubIds) + 1;
  const allocateNextId = (): number => {
    while (usedClubIds.has(nextId)) nextId++;
    usedClubIds.add(nextId);
    return nextId++;
  };
  const pyramidClubNames = new Set(SEED_DATA.clubs.map((c) => c.name));
  for (const pc of MEN_PYRAMID_CLUBS) {
    if (pyramidClubNames.has(pc.name)) {
      const seedClub = SEED_DATA.clubs.find((c) => c.name === pc.name)!;
      pyramidToClubId.set(pc.id, seedClub.id);
    } else {
      const existingId = existingClubByName.get(pc.name);
      if (existingId !== undefined) {
        pyramidToClubId.set(pc.id, existingId);
      } else if (usedClubIds.has(pc.id)) {
        pyramidToClubId.set(pc.id, allocateNextId());
      } else {
        pyramidToClubId.set(pc.id, pc.id);
        usedClubIds.add(pc.id);
      }
    }
  }
  const translateClubId = (pyramidClubId: number): number =>
    pyramidToClubId.get(pyramidClubId) ?? pyramidClubId;

  for (const cl of SEED_DATA.clubs) {
    const pc = MEN_PYRAMID_CLUBS.find((p) => p.name === cl.name);
    add(
      "INSERT INTO clubs (id, name, football_data_team_id, aliases, short_name, venue_id, official_site_url, generic_ticket_url, price_source_url, verified_at, source_url, league_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, football_data_team_id = excluded.football_data_team_id, aliases = excluded.aliases, short_name = excluded.short_name, venue_id = excluded.venue_id, official_site_url = excluded.official_site_url, generic_ticket_url = excluded.generic_ticket_url, price_source_url = excluded.price_source_url, verified_at = excluded.verified_at, source_url = excluded.source_url, league_name = excluded.league_name",
      [cl.id, cl.name, cl.football_data_team_id, cl.aliases, cl.short_name, cl.venue_id, cl.official_site_url, cl.generic_ticket_url, cl.price_source_url, cl.verified_at, pc?.source_url ?? cl.generic_ticket_url ?? null, pc?.league_name ?? null]
    );
  }

  for (const pc of MEN_PYRAMID_CLUBS) {
    if (!pyramidClubNames.has(pc.name)) {
      const newId = pyramidToClubId.get(pc.id)!;
      add(
        "INSERT INTO clubs (id, name, aliases, verified_at, source_url, league_name) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, aliases = excluded.aliases, verified_at = excluded.verified_at, source_url = excluded.source_url, league_name = excluded.league_name",
        [newId, pc.name, pc.aliases, pc.verified_at, pc.source_url, pc.league_name]
      );
    }
  }

  {
    const seasonDivisionById = new Map<number, { division_id: number }>();
    for (const sd of MEN_PYRAMID_SEASON_DIVISIONS) {
      seasonDivisionById.set(sd.id, { division_id: sd.division_id });
    }
    for (const membership of MEN_PYRAMID_MEMBERSHIPS) {
      if (membership.season_id !== latestPyramidSeasonId) continue;
      const seasonDivision = seasonDivisionById.get(membership.season_division_id);
      if (!seasonDivision) continue;
      add(
        "INSERT OR IGNORE INTO division_assignments (club_id, division_id) VALUES (?, ?)",
        [translateClubId(membership.club_id), seasonDivision.division_id]
      );
    }
  }

  // Lightweight validation: no duplicate club assignments, all refs exist
  const dupes = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM division_assignments GROUP BY club_id HAVING COUNT(*) > 1"
  );
  if (dupes && dupes.count > 0) {
    throw new Error("division_assignments has duplicate club entries.");
  }
  const badClubs = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM division_assignments da LEFT JOIN clubs c ON c.id = da.club_id WHERE c.id IS NULL"
  );
  if (badClubs && badClubs.count > 0) {
    throw new Error("division_assignments references non-existent clubs.");
  }
  const badDivs = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM division_assignments da LEFT JOIN pyramid_divisions d ON d.id = da.division_id WHERE d.id IS NULL"
  );
  if (badDivs && badDivs.count > 0) {
    throw new Error("division_assignments references non-existent divisions.");
  }

  for (const p of SEED_DATA.club_ticket_prices) {
    add(
      "INSERT INTO club_ticket_prices (club_id, sale_mode, adult_price_pence, concession_price_pence, source_url, verified_at, confidence) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(club_id) DO UPDATE SET sale_mode = excluded.sale_mode, adult_price_pence = excluded.adult_price_pence, concession_price_pence = excluded.concession_price_pence, source_url = excluded.source_url, verified_at = excluded.verified_at, confidence = excluded.confidence",
      [p.club_id, p.sale_mode, p.adult_price_pence, p.concession_price_pence, p.source_url, p.verified_at, p.confidence]
    );
  }

  for (const f of SEED_DATA.fixtures) {
    add(
      "INSERT INTO fixtures (source, source_id, competition_code, home_club_id, away_club_id, venue_id, kickoff_at, fixture_date, kickoff_time, kickoff_time_status, season_label, status, is_demo_data, is_historical, home_one_off, away_one_off, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source, source_id) DO UPDATE SET competition_code = excluded.competition_code, home_club_id = excluded.home_club_id, away_club_id = excluded.away_club_id, venue_id = excluded.venue_id, kickoff_at = excluded.kickoff_at, fixture_date = excluded.fixture_date, kickoff_time = excluded.kickoff_time, kickoff_time_status = excluded.kickoff_time_status, season_label = excluded.season_label, status = excluded.status, is_demo_data = excluded.is_demo_data, is_historical = excluded.is_historical, home_one_off = excluded.home_one_off, away_one_off = excluded.away_one_off, confidence = excluded.confidence",
      [f.source, f.source_id, f.competition_code, f.home_club_id, f.away_club_id, f.venue_id, f.kickoff_at, f.fixture_date, f.kickoff_time, f.kickoff_time_status, f.season_label, f.status, f.is_demo_data, f.is_historical, f.home_one_off, f.away_one_off, f.confidence]
    );
  }

  for (const t of SEED_DATA.travel_cache) {
    add(
      "INSERT INTO travel_cache (postcode_district, venue_id, distance_miles, driving_minutes, public_transport_minutes, provider, calculated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(postcode_district, venue_id) DO UPDATE SET distance_miles = excluded.distance_miles, driving_minutes = excluded.driving_minutes, public_transport_minutes = excluded.public_transport_minutes, provider = excluded.provider, calculated_at = excluded.calculated_at",
      [t.postcode_district, t.venue_id, t.distance_miles, t.driving_minutes, t.public_transport_minutes, t.provider, t.calculated_at]
    );
  }


  for (const assignment of CLUB_VENUE_ASSIGNMENTS) {
    add(
      "INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET club_id = excluded.club_id, venue_id = excluded.venue_id, effective_from = excluded.effective_from, effective_to = excluded.effective_to, is_primary = excluded.is_primary",
      [assignment.id, translateClubId(assignment.club_id), assignment.venue_id, assignment.effective_from, assignment.effective_to, assignment.is_primary]
    );
  }

  await binding.batch(statements);
}
