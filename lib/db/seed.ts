import type { Database as SqliteDatabase } from "better-sqlite3";
import { SEED_DATA } from "./d1.ts";
import {
  CLUB_VENUE_ASSIGNMENTS,
  computeDivisionDisplayOrder,
  computeEdgeAllocationType,
  MEN_PYRAMID_CLUBS,
  MEN_PYRAMID_DIVISIONS,
  MEN_PYRAMID_EDGES,
  MEN_PYRAMID_MEMBERSHIPS,
  MEN_PYRAMID_MOVEMENTS,
  MEN_PYRAMID_SEASON_DIVISIONS,
  MEN_PYRAMID_SEASONS,
  MEN_PYRAMID_TEMPLATE,
  validatePyramidSeason
} from "./pyramid.ts";

export function seedDatabase(db: SqliteDatabase): void {
  const divisionDisplayOrder = computeDivisionDisplayOrder();
  const edgeAllocationType = computeEdgeAllocationType();
  const latestPyramidSeasonId = Math.max(...MEN_PYRAMID_SEASONS.map((s) => s.id));
  const seasonDivisionById = new Map(MEN_PYRAMID_SEASON_DIVISIONS.map((d) => [d.id, d]));

  const seed = db.transaction(() => {
    const insertPyramidTemplate = db.prepare(`
      INSERT INTO pyramid_templates (id, code, name, sport, status)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        code = excluded.code,
        name = excluded.name,
        sport = excluded.sport,
        status = excluded.status
    `);
    insertPyramidTemplate.run(MEN_PYRAMID_TEMPLATE.id, MEN_PYRAMID_TEMPLATE.code, MEN_PYRAMID_TEMPLATE.name, MEN_PYRAMID_TEMPLATE.sport, MEN_PYRAMID_TEMPLATE.status);

    const insertPyramidDivision = db.prepare(`
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        template_id = excluded.template_id,
        code = excluded.code,
        name = excluded.name,
        level = excluded.level,
        max_size = excluded.max_size,
        display_order = excluded.display_order
    `);
    for (const division of MEN_PYRAMID_DIVISIONS) {
      insertPyramidDivision.run(division.id, division.template_id, division.code, division.name, division.level, division.max_size, divisionDisplayOrder.get(division.id) ?? null);
    }

    const insertPyramidEdge = db.prepare(`
      INSERT INTO pyramid_edges (id, from_division_id, to_division_id, movement_type, allocation_type)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        from_division_id = excluded.from_division_id,
        to_division_id = excluded.to_division_id,
        movement_type = excluded.movement_type,
        allocation_type = excluded.allocation_type
    `);
    for (const edge of MEN_PYRAMID_EDGES) {
      insertPyramidEdge.run(edge.id, edge.from_division_id, edge.to_division_id, edge.movement_type, edgeAllocationType.get(edge.id) ?? "allocation_dependent");
    }

    const insertPyramidSeason = db.prepare(`
      INSERT INTO pyramid_seasons (id, template_id, season_label)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        template_id = excluded.template_id,
        season_label = excluded.season_label
    `);
    for (const season of MEN_PYRAMID_SEASONS) {
      insertPyramidSeason.run(season.id, season.template_id, season.season_label);
    }

    const insertPyramidSeasonDivision = db.prepare(`
      INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status, locked_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        season_id = excluded.season_id,
        template_id = excluded.template_id,
        division_id = excluded.division_id,
        status = excluded.status,
        locked_at = excluded.locked_at
    `);
    for (const seasonDivision of MEN_PYRAMID_SEASON_DIVISIONS) {
      insertPyramidSeasonDivision.run(seasonDivision.id, seasonDivision.season_id, seasonDivision.template_id, seasonDivision.division_id, seasonDivision.status, seasonDivision.locked_at);
    }

    const insertVenue = db.prepare(`
      INSERT INTO venues (id, name, postcode, latitude, longitude, is_approximate)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        postcode = excluded.postcode,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        is_approximate = excluded.is_approximate
    `);
    for (const v of SEED_DATA.venues) {
      insertVenue.run(v.id, v.name, v.postcode, v.latitude, v.longitude, v.is_approximate);
    }

    const insertCompetition = db.prepare(`
      INSERT INTO competitions (code, name, tier, kind)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET name = excluded.name, tier = excluded.tier, kind = excluded.kind
    `);
    for (const c of SEED_DATA.competitions) {
      insertCompetition.run(c.code, c.name, c.tier, c.kind ?? "league");
    }

    const insertAppVenue = db.prepare(`
      INSERT INTO venues (id, name, postcode, latitude, longitude, is_approximate)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        postcode = excluded.postcode,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        is_approximate = excluded.is_approximate
    `);
    for (const v of SEED_DATA.venues) {
      insertAppVenue.run(v.id, v.name, v.postcode, v.latitude, v.longitude, v.is_approximate);
    }

    const pyramidClubByName = new Map<string, (typeof MEN_PYRAMID_CLUBS)[number]>();
    for (const pc of MEN_PYRAMID_CLUBS) {
      pyramidClubByName.set(pc.name, pc);
    }

    // Build ID translation: old pyramid_club_id → new clubs.id
    // SEED_DATA.clubs keep their existing IDs (1-6)
    // Pyramid-only clubs get max(seed_id)+1, max(seed_id)+2, ...
    const pyramidToClubId = new Map<number, number>();
    const maxPyramidId = Math.max(...MEN_PYRAMID_CLUBS.map((c) => c.id));
    const usedClubIds = new Set(SEED_DATA.clubs.map((c) => c.id));
    let nextId = Math.max(maxPyramidId, ...usedClubIds) + 1;
    const pyramidClubNames = new Set(SEED_DATA.clubs.map((c) => c.name));
    for (const pc of MEN_PYRAMID_CLUBS) {
      if (pyramidClubNames.has(pc.name)) {
        const seedClub = SEED_DATA.clubs.find((c) => c.name === pc.name)!;
        pyramidToClubId.set(pc.id, seedClub.id);
      } else {
        if (usedClubIds.has(pc.id)) {
          pyramidToClubId.set(pc.id, nextId++);
        } else {
          pyramidToClubId.set(pc.id, pc.id);
          usedClubIds.add(pc.id);
        }
      }
    }

    const insertClub = db.prepare(`
      INSERT INTO clubs (
        id, name, football_data_team_id, aliases, short_name, competition_code, venue_id,
        official_site_url, generic_ticket_url, price_source_url, verified_at,
        status, source_url, league_name, admin_updated_at,
        coordinate_precision, coordinates_verified_at, coordinates_confidence, coordinates_notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        football_data_team_id = excluded.football_data_team_id,
        aliases = excluded.aliases,
        short_name = excluded.short_name,
        competition_code = excluded.competition_code,
        venue_id = excluded.venue_id,
        official_site_url = excluded.official_site_url,
        generic_ticket_url = excluded.generic_ticket_url,
        price_source_url = excluded.price_source_url,
        verified_at = excluded.verified_at,
        status = excluded.status,
        source_url = excluded.source_url,
        league_name = excluded.league_name,
        admin_updated_at = excluded.admin_updated_at,
        coordinate_precision = excluded.coordinate_precision,
        coordinates_verified_at = excluded.coordinates_verified_at,
        coordinates_confidence = excluded.coordinates_confidence,
        coordinates_notes = excluded.coordinates_notes
    `);

    for (const cl of SEED_DATA.clubs) {
      const pyramidMatch = pyramidClubByName.get(cl.name);
      insertClub.run(
        cl.id, cl.name, cl.football_data_team_id, cl.aliases, cl.short_name,
        cl.competition_code, cl.venue_id, cl.official_site_url, cl.generic_ticket_url,
        cl.price_source_url, cl.verified_at,
        pyramidMatch?.status ?? "partial",
        pyramidMatch?.source_url ?? null,
        pyramidMatch?.league_name ?? null,
        null, null, null, null, null
      );
    }

    for (const pc of MEN_PYRAMID_CLUBS) {
      if (!pyramidClubNames.has(pc.name)) {
        const newId = pyramidToClubId.get(pc.id)!;
        insertClub.run(
          newId, pc.name, null, pc.aliases, null,
          null, null, null, null,
          null, pc.verified_at,
          pc.status, pc.source_url, pc.league_name,
          null, null, null, null, null
        );
      }
    }

    const translateClubId = (pyramidClubId: number): number =>
      pyramidToClubId.get(pyramidClubId) ?? pyramidClubId;

    const insertClubVenueAssignment = db.prepare(`
      INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        club_id = excluded.club_id,
        venue_id = excluded.venue_id,
        effective_from = excluded.effective_from,
        effective_to = excluded.effective_to,
        is_primary = excluded.is_primary
    `);
    for (const a of CLUB_VENUE_ASSIGNMENTS) {
      insertClubVenueAssignment.run(a.id, translateClubId(a.club_id), a.venue_id, a.effective_from, a.effective_to, a.is_primary);
    }

    const insertPyramidMembership = db.prepare(`
      INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        season_id = excluded.season_id,
        template_id = excluded.template_id,
        season_division_id = excluded.season_division_id,
        club_id = excluded.club_id
    `);
    for (const membership of MEN_PYRAMID_MEMBERSHIPS) {
      insertPyramidMembership.run(membership.id, membership.season_id, membership.template_id, membership.season_division_id, translateClubId(membership.club_id));
    }

    const insertDivisionAssignment = db.prepare(`
      INSERT OR IGNORE INTO division_assignments (club_id, division_id)
      VALUES (?, ?)
    `);
    const assignmentCount = db.prepare("SELECT COUNT(*) AS count FROM division_assignments").get() as { count: number };
    if (assignmentCount.count === 0) {
      for (const membership of MEN_PYRAMID_MEMBERSHIPS) {
        if (membership.season_id !== latestPyramidSeasonId) continue;
        const seasonDivision = seasonDivisionById.get(membership.season_division_id);
        if (!seasonDivision) continue;
        insertDivisionAssignment.run(translateClubId(membership.club_id), seasonDivision.division_id);
      }
    }

    const insertPyramidMovement = db.prepare(`
      INSERT INTO pyramid_movements (
        id, season_id, template_id, club_id, from_season_division_id, to_season_division_id,
        movement_type, note, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        season_id = excluded.season_id,
        template_id = excluded.template_id,
        club_id = excluded.club_id,
        from_season_division_id = excluded.from_season_division_id,
        to_season_division_id = excluded.to_season_division_id,
        movement_type = excluded.movement_type,
        note = excluded.note,
        created_at = excluded.created_at
    `);
    for (const movement of MEN_PYRAMID_MOVEMENTS) {
      insertPyramidMovement.run(
        movement.id,
        movement.season_id,
        movement.template_id,
        translateClubId(movement.club_id),
        movement.from_season_division_id,
        movement.to_season_division_id,
        movement.movement_type,
        movement.note,
        movement.created_at
      );
    }

    const pyramidIssues = validatePyramidSeason(MEN_PYRAMID_DIVISIONS, MEN_PYRAMID_SEASON_DIVISIONS, MEN_PYRAMID_MEMBERSHIPS, MEN_PYRAMID_MOVEMENTS);

    if (pyramidIssues.length > 0) {
      throw new Error(`Invalid pyramid seed data: ${pyramidIssues.map((issue) => issue.message).join("; ")}`);
    }

    const insertPrice = db.prepare(`
      INSERT INTO club_ticket_prices (
        club_id, sale_mode, adult_price_pence, concession_price_pence, source_url, verified_at, confidence
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(club_id) DO UPDATE SET
        sale_mode = excluded.sale_mode,
        adult_price_pence = excluded.adult_price_pence,
        concession_price_pence = excluded.concession_price_pence,
        source_url = excluded.source_url,
        verified_at = excluded.verified_at,
        confidence = excluded.confidence
    `);
    for (const p of SEED_DATA.club_ticket_prices) {
      insertPrice.run(p.club_id, p.sale_mode, p.adult_price_pence, p.concession_price_pence, p.source_url, p.verified_at, p.confidence);
    }

    const insertFixtureSeason = db.prepare(`
      INSERT INTO fixture_seasons (id, label, starts_on, ends_on, is_current)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        label = excluded.label,
        starts_on = excluded.starts_on,
        ends_on = excluded.ends_on,
        is_current = excluded.is_current
    `);
    insertFixtureSeason.run(1, "2025-26", "2025-08-01", "2026-07-31", 1);

    const insertFixture = db.prepare(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, fixture_date, kickoff_time, kickoff_time_status, season_label,
        status, is_demo_data, is_historical, home_one_off, away_one_off, confidence
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source, source_id) DO UPDATE SET
        competition_code = excluded.competition_code,
        home_club_id = excluded.home_club_id,
        away_club_id = excluded.away_club_id,
        venue_id = excluded.venue_id,
        kickoff_at = excluded.kickoff_at,
        fixture_date = excluded.fixture_date,
        kickoff_time = excluded.kickoff_time,
        kickoff_time_status = excluded.kickoff_time_status,
        season_label = excluded.season_label,
        status = excluded.status,
        is_demo_data = excluded.is_demo_data,
        is_historical = excluded.is_historical,
        home_one_off = excluded.home_one_off,
        away_one_off = excluded.away_one_off,
        confidence = excluded.confidence
    `);
    for (const f of SEED_DATA.fixtures) {
      insertFixture.run(f.source, f.source_id, f.competition_code, f.home_club_id, f.away_club_id, f.venue_id, f.kickoff_at, f.fixture_date, f.kickoff_time, f.kickoff_time_status, f.season_label, f.status, f.is_demo_data, f.is_historical, f.home_one_off, f.away_one_off, f.confidence);
    }

    const insertTravel = db.prepare(`
      INSERT INTO travel_cache (
        postcode_district, venue_id, distance_miles, driving_minutes,
        public_transport_minutes, provider, calculated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(postcode_district, venue_id) DO UPDATE SET
        distance_miles = excluded.distance_miles,
        driving_minutes = excluded.driving_minutes,
        public_transport_minutes = excluded.public_transport_minutes,
        provider = excluded.provider,
        calculated_at = excluded.calculated_at
    `);
    for (const t of SEED_DATA.travel_cache) {
      insertTravel.run(t.postcode_district, t.venue_id, t.distance_miles, t.driving_minutes, t.public_transport_minutes, t.provider, t.calculated_at);
    }
  });

  seed();
}
