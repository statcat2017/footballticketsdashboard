import type { Database as SqliteDatabase } from "better-sqlite3";
import { SEED_DATA } from "./d1.ts";
import {
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
      INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        template_id = excluded.template_id,
        code = excluded.code,
        name = excluded.name,
        level = excluded.level,
        max_size = excluded.max_size
    `);
    for (const division of MEN_PYRAMID_DIVISIONS) {
      insertPyramidDivision.run(division.id, division.template_id, division.code, division.name, division.level, division.max_size);
    }

    const insertPyramidEdge = db.prepare(`
      INSERT INTO pyramid_edges (id, from_division_id, to_division_id, movement_type, slots)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        from_division_id = excluded.from_division_id,
        to_division_id = excluded.to_division_id,
        movement_type = excluded.movement_type,
        slots = excluded.slots
    `);
    for (const edge of MEN_PYRAMID_EDGES) {
      insertPyramidEdge.run(edge.id, edge.from_division_id, edge.to_division_id, edge.movement_type, edge.slots);
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

    const insertPyramidClub = db.prepare(`
      INSERT INTO pyramid_clubs (
        id, name, aliases, league_name, ground_name, ground_address, postcode,
        latitude, longitude, source_url, verified_at, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        aliases = excluded.aliases,
        league_name = excluded.league_name,
        ground_name = excluded.ground_name,
        ground_address = excluded.ground_address,
        postcode = excluded.postcode,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        source_url = excluded.source_url,
        verified_at = excluded.verified_at,
        status = excluded.status
    `);
    for (const club of MEN_PYRAMID_CLUBS) {
      insertPyramidClub.run(
        club.id,
        club.name,
        club.aliases,
        club.league_name,
        club.ground_name,
        club.ground_address,
        club.postcode,
        club.latitude,
        club.longitude,
        club.source_url,
        club.verified_at,
        club.status
      );
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
      insertPyramidMembership.run(membership.id, membership.season_id, membership.template_id, membership.season_division_id, membership.club_id);
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
        movement.club_id,
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

    const insertCompetition = db.prepare(`
      INSERT INTO competitions (code, name, tier)
      VALUES (?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET name = excluded.name, tier = excluded.tier
    `);
    for (const c of SEED_DATA.competitions) {
      insertCompetition.run(c.code, c.name, c.tier);
    }

    const insertVenue = db.prepare(`
      INSERT INTO venues (id, name, postcode, latitude, longitude)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        postcode = excluded.postcode,
        latitude = excluded.latitude,
        longitude = excluded.longitude
    `);
    for (const v of SEED_DATA.venues) {
      insertVenue.run(v.id, v.name, v.postcode, v.latitude, v.longitude);
    }

    const insertClub = db.prepare(`
      INSERT INTO clubs (id, name, football_data_team_id, aliases, short_name, competition_code, venue_id, official_site_url, generic_ticket_url, price_source_url, verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        verified_at = excluded.verified_at
    `);
    for (const cl of SEED_DATA.clubs) {
      insertClub.run(cl.id, cl.name, cl.football_data_team_id, cl.aliases, cl.short_name, cl.competition_code, cl.venue_id, cl.official_site_url, cl.generic_ticket_url, cl.price_source_url, cl.verified_at);
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

    const insertFixture = db.prepare(`
      INSERT INTO fixtures (
        source, source_id, competition_code, home_club_id, away_club_id, venue_id,
        kickoff_at, status, is_demo_data, is_historical
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source, source_id) DO UPDATE SET
        competition_code = excluded.competition_code,
        home_club_id = excluded.home_club_id,
        away_club_id = excluded.away_club_id,
        venue_id = excluded.venue_id,
        kickoff_at = excluded.kickoff_at,
        status = excluded.status,
        is_demo_data = excluded.is_demo_data,
        is_historical = excluded.is_historical
    `);
    for (const f of SEED_DATA.fixtures) {
      insertFixture.run(f.source, f.source_id, f.competition_code, f.home_club_id, f.away_club_id, f.venue_id, f.kickoff_at, f.status, f.is_demo_data, f.is_historical);
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
