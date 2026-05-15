import { createD1AppDatabase, type AppDatabase, type D1DatabaseLike } from "./adapter.ts";
import { schemaSql } from "./schema.ts";
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

export interface SeedData {
  competitions: Array<{ code: string; name: string; tier: number }>;
  venues: Array<{ id: number; name: string; postcode: string; latitude: number; longitude: number }>;
  clubs: Array<{ id: number; name: string; football_data_team_id: number; aliases: string; short_name: string; competition_code: string; venue_id: number; official_site_url: string; generic_ticket_url: string; price_source_url: string; verified_at: string }>;
  club_ticket_prices: Array<{ club_id: number; sale_mode: string; adult_price_pence: number; concession_price_pence: number; source_url: string; verified_at: string; confidence: string }>;
  fixtures: Array<{ source: string; source_id: string; competition_code: string; home_club_id: number; away_club_id: number; venue_id: number; kickoff_at: string; status: string; is_demo_data: number; is_historical: number }>;
  travel_cache: Array<{ postcode_district: string; venue_id: number; distance_miles: number; driving_minutes: number; public_transport_minutes: number; provider: string; calculated_at: string }>;
}

export const SEED_DATA: SeedData = {
  competitions: [
    { code: "PL", name: "Premier League", tier: 1 },
    { code: "ELC", name: "Championship", tier: 2 }
  ],
  venues: [
    { id: 1, name: "Stamford Bridge", postcode: "SW6 1HS", latitude: 51.4817, longitude: -0.191 },
    { id: 2, name: "Loftus Road", postcode: "W12 7PJ", latitude: 51.509, longitude: -0.2321 },
    { id: 3, name: "Emirates Stadium", postcode: "N5 1BU", latitude: 51.5549, longitude: -0.1084 },
    { id: 4, name: "Old Trafford", postcode: "M16 0RA", latitude: 53.4631, longitude: -2.2913 },
    { id: 5, name: "Carrow Road", postcode: "NR1 1JE", latitude: 52.6221, longitude: 1.3091 },
    { id: 6, name: "St Andrew's", postcode: "B9 4RL", latitude: 52.4756, longitude: -1.8682 }
  ],
  clubs: [
    { id: 1, name: "Chelsea", football_data_team_id: 61, aliases: "Chelsea FC|Chelsea", short_name: "Chelsea", competition_code: "PL", venue_id: 1, official_site_url: "https://www.chelseafc.com/", generic_ticket_url: "https://www.chelseafc.com/en/tickets", price_source_url: "https://www.chelseafc.com/en/tickets", verified_at: "2026-05-10" },
    { id: 2, name: "Arsenal", football_data_team_id: 57, aliases: "Arsenal FC|Arsenal", short_name: "Arsenal", competition_code: "PL", venue_id: 3, official_site_url: "https://www.arsenal.com/", generic_ticket_url: "https://www.arsenal.com/tickets", price_source_url: "https://www.arsenal.com/tickets", verified_at: "2026-05-10" },
    { id: 3, name: "Manchester United", football_data_team_id: 66, aliases: "Manchester United FC|Manchester United|Man United|Man Utd", short_name: "Man Utd", competition_code: "PL", venue_id: 4, official_site_url: "https://www.manutd.com/", generic_ticket_url: "https://tickets.manutd.com/", price_source_url: "https://tickets.manutd.com/", verified_at: "2026-05-10" },
    { id: 4, name: "Queens Park Rangers", football_data_team_id: 69, aliases: "Queens Park Rangers FC|Queens Park Rangers|QPR", short_name: "QPR", competition_code: "ELC", venue_id: 2, official_site_url: "https://www.qpr.co.uk/", generic_ticket_url: "https://www.eticketing.co.uk/qpr/", price_source_url: "https://www.eticketing.co.uk/qpr/", verified_at: "2026-05-10" },
    { id: 5, name: "Norwich City", football_data_team_id: 68, aliases: "Norwich City FC|Norwich City|Norwich", short_name: "Norwich", competition_code: "ELC", venue_id: 5, official_site_url: "https://www.canaries.co.uk/", generic_ticket_url: "https://tickets.canaries.co.uk/", price_source_url: "https://tickets.canaries.co.uk/", verified_at: "2026-05-10" },
    { id: 6, name: "Birmingham City", football_data_team_id: 332, aliases: "Birmingham City FC|Birmingham City|Birmingham", short_name: "Birmingham", competition_code: "ELC", venue_id: 6, official_site_url: "https://www.bcfc.com/", generic_ticket_url: "https://www.bcfc.com/tickets/", price_source_url: "https://www.bcfc.com/tickets/", verified_at: "2026-05-10" }
  ],
  club_ticket_prices: [
    { club_id: 1, sale_mode: "all_ticket", adult_price_pence: 3000, concession_price_pence: 2000, source_url: "https://www.chelseafc.com/en/tickets", verified_at: "2026-05-10", confidence: "seed" },
    { club_id: 2, sale_mode: "all_ticket", adult_price_pence: 2800, concession_price_pence: 1800, source_url: "https://www.arsenal.com/tickets", verified_at: "2026-05-10", confidence: "seed" },
    { club_id: 3, sale_mode: "all_ticket", adult_price_pence: 3100, concession_price_pence: 2100, source_url: "https://tickets.manutd.com/", verified_at: "2026-05-10", confidence: "seed" },
    { club_id: 4, sale_mode: "pay_on_gate", adult_price_pence: 2200, concession_price_pence: 1500, source_url: "https://www.eticketing.co.uk/qpr/", verified_at: "2026-05-10", confidence: "seed" },
    { club_id: 5, sale_mode: "all_ticket", adult_price_pence: 2500, concession_price_pence: 1700, source_url: "https://tickets.canaries.co.uk/", verified_at: "2026-05-10", confidence: "seed" },
    { club_id: 6, sale_mode: "pay_on_gate", adult_price_pence: 2000, concession_price_pence: 1200, source_url: "https://www.bcfc.com/tickets/", verified_at: "2026-05-10", confidence: "seed" }
  ],
  fixtures: [
    { source: "historical_seed", source_id: "pl-che-ars-2025-05-18", competition_code: "PL", home_club_id: 1, away_club_id: 2, venue_id: 1, kickoff_at: "2025-05-18T15:00:00.000Z", status: "finished", is_demo_data: 1, is_historical: 1 },
    { source: "historical_seed", source_id: "elc-qpr-nor-2025-05-03", competition_code: "ELC", home_club_id: 4, away_club_id: 5, venue_id: 2, kickoff_at: "2025-05-03T14:00:00.000Z", status: "finished", is_demo_data: 1, is_historical: 1 },
    { source: "historical_seed", source_id: "pl-mut-che-2025-05-25", competition_code: "PL", home_club_id: 3, away_club_id: 1, venue_id: 4, kickoff_at: "2025-05-25T15:00:00.000Z", status: "finished", is_demo_data: 1, is_historical: 1 },
    { source: "historical_seed", source_id: "elc-bir-qpr-2025-04-26", competition_code: "ELC", home_club_id: 6, away_club_id: 4, venue_id: 6, kickoff_at: "2025-04-26T14:00:00.000Z", status: "finished", is_demo_data: 1, is_historical: 1 }
  ],
  travel_cache: [
    { postcode_district: "SW6", venue_id: 1, distance_miles: 0.4, driving_minutes: 6, public_transport_minutes: 8, provider: "seed", calculated_at: "2026-05-10T00:00:00.000Z" },
    { postcode_district: "SW6", venue_id: 2, distance_miles: 3.7, driving_minutes: 22, public_transport_minutes: 28, provider: "seed", calculated_at: "2026-05-10T00:00:00.000Z" },
    { postcode_district: "SW6", venue_id: 3, distance_miles: 8.8, driving_minutes: 42, public_transport_minutes: 43, provider: "seed", calculated_at: "2026-05-10T00:00:00.000Z" },
    { postcode_district: "W12", venue_id: 1, distance_miles: 3.5, driving_minutes: 20, public_transport_minutes: 27, provider: "seed", calculated_at: "2026-05-10T00:00:00.000Z" },
    { postcode_district: "W12", venue_id: 2, distance_miles: 0.3, driving_minutes: 4, public_transport_minutes: 6, provider: "seed", calculated_at: "2026-05-10T00:00:00.000Z" },
    { postcode_district: "M16", venue_id: 4, distance_miles: 0.3, driving_minutes: 4, public_transport_minutes: 7, provider: "seed", calculated_at: "2026-05-10T00:00:00.000Z" }
  ]
};

export function createD1Database(binding: D1DatabaseLike): AppDatabase {
  return createD1AppDatabase(binding);
}

export async function initializeD1Database(binding: D1DatabaseLike): Promise<void> {
  const db = createD1Database(binding);

  await db.exec(schemaSql);

  const pyramidIssues = validatePyramidSeason(MEN_PYRAMID_DIVISIONS, MEN_PYRAMID_SEASON_DIVISIONS, MEN_PYRAMID_MEMBERSHIPS, MEN_PYRAMID_MOVEMENTS);

  if (pyramidIssues.length > 0) {
    throw new Error(`Invalid pyramid seed data: ${pyramidIssues.map((issue) => issue.message).join("; ")}`);
  }

  await db.exec("BEGIN TRANSACTION");

  try {
    await db.run(
      "INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET code = excluded.code, name = excluded.name, sport = excluded.sport, status = excluded.status",
      [MEN_PYRAMID_TEMPLATE.id, MEN_PYRAMID_TEMPLATE.code, MEN_PYRAMID_TEMPLATE.name, MEN_PYRAMID_TEMPLATE.sport, MEN_PYRAMID_TEMPLATE.status]
    );

    for (const division of MEN_PYRAMID_DIVISIONS) {
      await db.run(
        "INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET template_id = excluded.template_id, code = excluded.code, name = excluded.name, level = excluded.level, max_size = excluded.max_size",
        [division.id, division.template_id, division.code, division.name, division.level, division.max_size]
      );
    }

    for (const edge of MEN_PYRAMID_EDGES) {
      await db.run(
        "INSERT INTO pyramid_edges (id, from_division_id, to_division_id, movement_type, slots) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET from_division_id = excluded.from_division_id, to_division_id = excluded.to_division_id, movement_type = excluded.movement_type, slots = excluded.slots",
        [edge.id, edge.from_division_id, edge.to_division_id, edge.movement_type, edge.slots]
      );
    }

    for (const season of MEN_PYRAMID_SEASONS) {
      await db.run(
        "INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET template_id = excluded.template_id, season_label = excluded.season_label",
        [season.id, season.template_id, season.season_label]
      );
    }

    for (const seasonDivision of MEN_PYRAMID_SEASON_DIVISIONS) {
      await db.run(
        "INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status, locked_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET season_id = excluded.season_id, template_id = excluded.template_id, division_id = excluded.division_id, status = excluded.status, locked_at = excluded.locked_at",
        [seasonDivision.id, seasonDivision.season_id, seasonDivision.template_id, seasonDivision.division_id, seasonDivision.status, seasonDivision.locked_at]
      );
    }

    for (const club of MEN_PYRAMID_CLUBS) {
      await db.run(
        "INSERT INTO pyramid_clubs (id, name, aliases, league_name, ground_name, ground_address, postcode, latitude, longitude, source_url, verified_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, aliases = excluded.aliases, league_name = excluded.league_name, ground_name = excluded.ground_name, ground_address = excluded.ground_address, postcode = excluded.postcode, latitude = excluded.latitude, longitude = excluded.longitude, source_url = excluded.source_url, verified_at = excluded.verified_at, status = excluded.status",
        [club.id, club.name, club.aliases, club.league_name, club.ground_name, club.ground_address, club.postcode, club.latitude, club.longitude, club.source_url, club.verified_at, club.status]
      );
    }

    for (const cl of SEED_DATA.clubs) {
      await db.run(
        "INSERT INTO clubs (id, name, football_data_team_id, aliases, short_name, competition_code, venue_id, official_site_url, generic_ticket_url, price_source_url, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, football_data_team_id = excluded.football_data_team_id, aliases = excluded.aliases, short_name = excluded.short_name, competition_code = excluded.competition_code, venue_id = excluded.venue_id, official_site_url = excluded.official_site_url, generic_ticket_url = excluded.generic_ticket_url, price_source_url = excluded.price_source_url, verified_at = excluded.verified_at",
        [cl.id, cl.name, cl.football_data_team_id, cl.aliases, cl.short_name, cl.competition_code, cl.venue_id, cl.official_site_url, cl.generic_ticket_url, cl.price_source_url, cl.verified_at]
      );
    }

    for (const membership of MEN_PYRAMID_MEMBERSHIPS) {
      await db.run(
        "INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET season_id = excluded.season_id, template_id = excluded.template_id, season_division_id = excluded.season_division_id, club_id = excluded.club_id",
        [membership.id, membership.season_id, membership.template_id, membership.season_division_id, membership.club_id]
      );
    }

    for (const movement of MEN_PYRAMID_MOVEMENTS) {
      await db.run(
        "INSERT INTO pyramid_movements (id, season_id, template_id, club_id, from_season_division_id, to_season_division_id, movement_type, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET season_id = excluded.season_id, template_id = excluded.template_id, club_id = excluded.club_id, from_season_division_id = excluded.from_season_division_id, to_season_division_id = excluded.to_season_division_id, movement_type = excluded.movement_type, note = excluded.note, created_at = excluded.created_at",
        [movement.id, movement.season_id, movement.template_id, movement.club_id, movement.from_season_division_id, movement.to_season_division_id, movement.movement_type, movement.note, movement.created_at]
      );
    }

    for (const c of SEED_DATA.competitions) {
      await db.run(
        "INSERT INTO competitions (code, name, tier) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name, tier = excluded.tier",
        [c.code, c.name, c.tier]
      );
    }

    for (const v of SEED_DATA.venues) {
      await db.run(
        "INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, postcode = excluded.postcode, latitude = excluded.latitude, longitude = excluded.longitude",
        [v.id, v.name, v.postcode, v.latitude, v.longitude]
      );
    }

    for (const p of SEED_DATA.club_ticket_prices) {
      await db.run(
        "INSERT INTO club_ticket_prices (club_id, sale_mode, adult_price_pence, concession_price_pence, source_url, verified_at, confidence) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(club_id) DO UPDATE SET sale_mode = excluded.sale_mode, adult_price_pence = excluded.adult_price_pence, concession_price_pence = excluded.concession_price_pence, source_url = excluded.source_url, verified_at = excluded.verified_at, confidence = excluded.confidence",
        [p.club_id, p.sale_mode, p.adult_price_pence, p.concession_price_pence, p.source_url, p.verified_at, p.confidence]
      );
    }

    for (const f of SEED_DATA.fixtures) {
      await db.run(
        "INSERT INTO fixtures (source, source_id, competition_code, home_club_id, away_club_id, venue_id, kickoff_at, status, is_demo_data, is_historical) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source, source_id) DO UPDATE SET competition_code = excluded.competition_code, home_club_id = excluded.home_club_id, away_club_id = excluded.away_club_id, venue_id = excluded.venue_id, kickoff_at = excluded.kickoff_at, status = excluded.status, is_demo_data = excluded.is_demo_data, is_historical = excluded.is_historical",
        [f.source, f.source_id, f.competition_code, f.home_club_id, f.away_club_id, f.venue_id, f.kickoff_at, f.status, f.is_demo_data, f.is_historical]
      );
    }

    for (const t of SEED_DATA.travel_cache) {
      await db.run(
        "INSERT INTO travel_cache (postcode_district, venue_id, distance_miles, driving_minutes, public_transport_minutes, provider, calculated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(postcode_district, venue_id) DO UPDATE SET distance_miles = excluded.distance_miles, driving_minutes = excluded.driving_minutes, public_transport_minutes = excluded.public_transport_minutes, provider = excluded.provider, calculated_at = excluded.calculated_at",
        [t.postcode_district, t.venue_id, t.distance_miles, t.driving_minutes, t.public_transport_minutes, t.provider, t.calculated_at]
      );
    }

    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}
