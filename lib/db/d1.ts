import { createD1AppDatabase, type AppDatabase, type D1DatabaseLike, type D1PreparedStatement } from "./adapter.ts";
import { schemaSql } from "./schema.ts";
import {
  CLUB_VENUE_ASSIGNMENTS,
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
    { id: 6, name: "St Andrew's", postcode: "B9 4RL", latitude: 52.4756, longitude: -1.8682 },
    { id: 7, name: "Villa Park", postcode: "B6 6HE", latitude: 52.509, longitude: -1.885 },
    { id: 8, name: "Dean Court", postcode: "BH7 7AF", latitude: 50.735, longitude: -1.838 },
    { id: 9, name: "Brentford Community Stadium", postcode: "TW8 0RU", latitude: 51.491, longitude: -0.289 },
    { id: 10, name: "Falmer Stadium", postcode: "BN1 9BL", latitude: 50.862, longitude: -0.083 },
    { id: 11, name: "Turf Moor", postcode: "BB10 4BX", latitude: 53.789, longitude: -2.23 },
    { id: 12, name: "Selhurst Park", postcode: "SE25 6PU", latitude: 51.398, longitude: -0.086 },
    { id: 13, name: "Hill Dickinson Stadium", postcode: "L4 0TH", latitude: 53.425, longitude: -3.003 },
    { id: 14, name: "Craven Cottage", postcode: "SW6 6HH", latitude: 51.475, longitude: -0.222 },
    { id: 15, name: "Elland Road", postcode: "LS11 0ES", latitude: 53.778, longitude: -1.572 },
    { id: 16, name: "Anfield", postcode: "L4 0TH", latitude: 53.431, longitude: -2.961 },
    { id: 17, name: "City of Manchester Stadium", postcode: "M11 3FF", latitude: 53.483, longitude: -2.2 },
    { id: 18, name: "St James' Park", postcode: "NE1 4ST", latitude: 54.975, longitude: -1.622 },
    { id: 19, name: "City Ground", postcode: "NG2 5FJ", latitude: 52.94, longitude: -1.133 },
    { id: 20, name: "Stadium of Light", postcode: "SR5 1SU", latitude: 54.914, longitude: -1.388 },
    { id: 21, name: "Tottenham Hotspur Stadium", postcode: "N17 0AP", latitude: 51.603, longitude: -0.066 },
    { id: 22, name: "London Stadium", postcode: "E20 2ST", latitude: 51.538, longitude: -0.017 },
    { id: 23, name: "Molineux Stadium", postcode: "WV1 4QR", latitude: 52.59, longitude: -2.13 },
    { id: 24, name: "Ewood Park", postcode: "BB2 4JF", latitude: 53.728, longitude: -2.489 },
    { id: 25, name: "Ashton Gate", postcode: "BS3 2EJ", latitude: 51.44, longitude: -2.62 },
    { id: 26, name: "The Valley", postcode: "SE7 8BL", latitude: 51.487, longitude: 0.037 },
    { id: 27, name: "Coventry Building Society Arena", postcode: "CV6 6GE", latitude: 52.448, longitude: -1.496 },
    { id: 28, name: "Pride Park", postcode: "DE24 8XL", latitude: 52.915, longitude: -1.447 },
    { id: 29, name: "MKM Stadium", postcode: "HU3 6HU", latitude: 53.746, longitude: -0.368 },
    { id: 30, name: "Portman Road", postcode: "IP1 2DA", latitude: 52.055, longitude: 1.145 },
    { id: 31, name: "King Power Stadium", postcode: "LE2 7FL", latitude: 52.62, longitude: -1.142 },
    { id: 32, name: "Riverside Stadium", postcode: "TS3 6RS", latitude: 54.578, longitude: -1.218 },
    { id: 33, name: "The Den", postcode: "SE16 3LN", latitude: 51.486, longitude: -0.05 },
    { id: 34, name: "Kassam Stadium", postcode: "OX4 4XP", latitude: 51.716, longitude: -1.208 },
    { id: 35, name: "Fratton Park", postcode: "PO4 8RA", latitude: 50.796, longitude: -1.064 },
    { id: 36, name: "Deepdale", postcode: "PR1 6RU", latitude: 53.772, longitude: -2.688 },
    { id: 37, name: "Bramall Lane", postcode: "S2 4SU", latitude: 53.369, longitude: -1.471 },
    { id: 38, name: "Hillsborough Stadium", postcode: "S6 1SW", latitude: 53.412, longitude: -1.501 },
    { id: 39, name: "St Mary's Stadium", postcode: "SO14 5FP", latitude: 50.906, longitude: -1.391 },
    { id: 40, name: "bet365 Stadium", postcode: "ST4 4EG", latitude: 52.988, longitude: -2.175 },
    { id: 41, name: "Swansea.com Stadium", postcode: "SA1 2FA", latitude: 51.642, longitude: -3.935 },
    { id: 42, name: "Vicarage Road", postcode: "WD18 0ER", latitude: 51.65, longitude: -0.402 },
    { id: 43, name: "The Hawthorns", postcode: "B71 4LF", latitude: 52.509, longitude: -1.964 },
    { id: 44, name: "Racecourse Ground", postcode: "LL11 2AH", latitude: 53.052, longitude: -3.005 },
    { id: 45, name: "Plough Lane", postcode: "SW19 4RG", latitude: 51.425, longitude: -0.179 },
    { id: 46, name: "Oakwell", postcode: "S71 1ET", latitude: 53.552, longitude: -1.467 },
    { id: 47, name: "Bloomfield Road", postcode: "FY1 6JJ", latitude: 53.805, longitude: -3.048 },
    { id: 48, name: "Toughsheet Community Stadium", postcode: "BL6 6JW", latitude: 53.58, longitude: -2.536 },
    { id: 49, name: "Valley Parade", postcode: "BD8 7DY", latitude: 53.804, longitude: -1.759 },
    { id: 50, name: "Pirelli Stadium", postcode: "DE13 0BH", latitude: 52.822, longitude: -1.627 },
    { id: 51, name: "Cardiff City Stadium", postcode: "CF11 8AZ", latitude: 51.473, longitude: -3.203 },
    { id: 52, name: "Eco-Power Stadium", postcode: "DN4 5JW", latitude: 53.51, longitude: -1.114 },
    { id: 53, name: "St. James Park (Exeter)", postcode: "EX4 6PX", latitude: 50.73, longitude: -3.521 },
    { id: 54, name: "Kirklees Stadium", postcode: "HD1 6PX", latitude: 53.655, longitude: -1.768 },
    { id: 55, name: "Brisbane Road", postcode: "E10 5NF", latitude: 51.56, longitude: -0.013 },
    { id: 56, name: "Sincil Bank", postcode: "LN5 8LD", latitude: 53.22, longitude: -0.54 },
    { id: 57, name: "Kenilworth Road", postcode: "LU1 1DH", latitude: 51.884, longitude: -0.428 },
    { id: 58, name: "Field Mill", postcode: "NG18 5DA", latitude: 53.138, longitude: -1.201 },
    { id: 59, name: "Sixfields Stadium", postcode: "NN5 5QA", latitude: 52.235, longitude: -0.932 },
    { id: 60, name: "London Road Stadium", postcode: "PE2 8AL", latitude: 52.565, longitude: -0.24 },
    { id: 61, name: "Home Park", postcode: "PL2 3DQ", latitude: 50.388, longitude: -4.151 },
    { id: 62, name: "Vale Park", postcode: "ST6 1AW", latitude: 53.049, longitude: -2.189 },
    { id: 63, name: "Madejski Stadium", postcode: "RG2 0FL", latitude: 51.422, longitude: -0.983 },
    { id: 64, name: "New York Stadium", postcode: "S60 1AH", latitude: 53.428, longitude: -1.362 },
    { id: 65, name: "Broadhall Way", postcode: "SG2 8RH", latitude: 51.886, longitude: -0.19 },
    { id: 66, name: "Edgeley Park", postcode: "SK3 9DD", latitude: 53.4, longitude: -2.167 },
    { id: 67, name: "Brick Community Stadium", postcode: "WN5 0UZ", latitude: 53.548, longitude: -2.654 },
    { id: 68, name: "Adams Park", postcode: "HP12 4HJ", latitude: 51.63, longitude: -0.8 },
    { id: 69, name: "Crown Ground", postcode: "BB5 5BX", latitude: 53.765, longitude: -2.37 },
    { id: 70, name: "The Hive Stadium", postcode: "HA8 5AU", latitude: 51.603, longitude: -0.292 },
    { id: 71, name: "Holker Street", postcode: "LA13 9HJ", latitude: 54.12, longitude: -3.226 },
    { id: 72, name: "Memorial Stadium", postcode: "BS7 0BF", latitude: 51.486, longitude: -2.583 },
    { id: 73, name: "Hayes Lane", postcode: "BR2 9EH", latitude: 51.382, longitude: 0.018 },
    { id: 74, name: "Abbey Stadium", postcode: "CB5 8LN", latitude: 52.212, longitude: 0.153 },
    { id: 75, name: "Whaddon Road", postcode: "GL52 5NA", latitude: 51.907, longitude: -2.058 },
    { id: 76, name: "SMH Group Stadium", postcode: "S41 8NZ", latitude: 53.258, longitude: -1.438 },
    { id: 77, name: "Colchester Community Stadium", postcode: "CO4 5UP", latitude: 51.923, longitude: 0.897 },
    { id: 78, name: "Broadfield Stadium", postcode: "RH11 9RX", latitude: 51.099, longitude: -0.195 },
    { id: 79, name: "Gresty Road", postcode: "CW2 6EB", latitude: 53.088, longitude: -2.436 },
    { id: 80, name: "Highbury Stadium", postcode: "FY7 6TX", latitude: 53.917, longitude: -3.021 },
    { id: 81, name: "Priestfield Stadium", postcode: "ME7 4DD", latitude: 51.378, longitude: 0.561 },
    { id: 82, name: "Blundell Park", postcode: "DN35 7PY", latitude: 53.57, longitude: -0.046 },
    { id: 83, name: "Wetherby Road", postcode: "HG3 1SA", latitude: 53.991, longitude: -1.537 },
    { id: 84, name: "Stadium MK", postcode: "MK1 1ST", latitude: 52.009, longitude: -0.733 },
    { id: 85, name: "Rodney Parade", postcode: "NP19 0UU", latitude: 51.591, longitude: -2.994 },
    { id: 86, name: "Meadow Lane", postcode: "NG2 3HJ", latitude: 52.932, longitude: -1.135 },
    { id: 87, name: "Boundary Park", postcode: "OL1 2PA", latitude: 53.556, longitude: -2.119 },
    { id: 88, name: "Moor Lane", postcode: "M7 3PZ", latitude: 53.5, longitude: -2.272 },
    { id: 89, name: "New Meadow", postcode: "SY2 6AB", latitude: 52.68, longitude: -2.75 },
    { id: 90, name: "County Ground", postcode: "SN1 2ED", latitude: 51.564, longitude: -1.771 },
    { id: 91, name: "Prenton Park", postcode: "CH42 9QA", latitude: 53.373, longitude: -3.036 },
    { id: 92, name: "Bescot Stadium", postcode: "WS1 4SA", latitude: 52.565, longitude: -1.991 },
    { id: 93, name: "The Recreation Ground", postcode: "GU11 2TU", latitude: 51.241, longitude: -0.77 },
    { id: 94, name: "Moss Lane", postcode: "WA15 8AP", latitude: 53.383, longitude: -2.332 },
    { id: 95, name: "Meadow Park", postcode: "WD6 1EA", latitude: 51.671, longitude: -0.274 },
    { id: 96, name: "Boston Community Stadium", postcode: "PE21 7JJ", latitude: 52.977, longitude: -0.032 },
    { id: 97, name: "St. James Park (Brackley)", postcode: "NN13 6EJ", latitude: 52.029, longitude: -1.14 },
    { id: 98, name: "Cressing Road", postcode: "CM7 3PS", latitude: 51.877, longitude: 0.548 },
    { id: 99, name: "Brunton Park", postcode: "CA1 7TJ", latitude: 54.895, longitude: -2.93 },
    { id: 100, name: "Ten Acres", postcode: "SO50 9HT", latitude: 50.946, longitude: -1.346 },
    { id: 101, name: "The Shay", postcode: "HX1 2YS", latitude: 53.72, longitude: -1.867 },
    { id: 102, name: "The New Lawn", postcode: "GL6 0FG", latitude: 51.706, longitude: -2.242 },
    { id: 103, name: "Gateshead International Stadium", postcode: "NE11 0EH", latitude: 54.961, longitude: -1.605 },
    { id: 104, name: "Victoria Park", postcode: "TS24 8BZ", latitude: 54.69, longitude: -1.22 },
    { id: 105, name: "Mazuma Mobile Stadium", postcode: "LA4 4TB", latitude: 54.065, longitude: -2.87 },
    { id: 106, name: "Spotland Stadium", postcode: "OL11 5DS", latitude: 53.619, longitude: -2.157 },
    { id: 107, name: "Glanford Park", postcode: "DN15 8TD", latitude: 53.586, longitude: -0.693 },
    { id: 108, name: "Damson Park", postcode: "B92 9EJ", latitude: 52.418, longitude: -1.768 },
    { id: 109, name: "Roots Hall", postcode: "SS2 6NQ", latitude: 51.537, longitude: 0.724 },
    { id: 110, name: "Gander Green Lane", postcode: "SM1 2EY", latitude: 51.365, longitude: -0.191 },
    { id: 111, name: "The Lamb Ground", postcode: "B77 4EW", latitude: 52.874, longitude: -1.654 },
    { id: 112, name: "Truro City Stadium", postcode: "TR1 2JF", latitude: 50.267, longitude: -5.053 },
    { id: 113, name: "Grosvenor Vale", postcode: "HA5 3PP", latitude: 51.591, longitude: -0.378 },
    { id: 114, name: "Kingfield Stadium", postcode: "GU22 9AA", latitude: 51.306, longitude: -0.563 },
    { id: 115, name: "Huish Park", postcode: "BA22 8YF", latitude: 50.944, longitude: -2.652 },
    { id: 116, name: "York Community Stadium", postcode: "YO32 9LL", latitude: 53.985, longitude: -1.053 },
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
      "INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET template_id = excluded.template_id, code = excluded.code, name = excluded.name, level = excluded.level, max_size = excluded.max_size",
      [division.id, division.template_id, division.code, division.name, division.level, division.max_size]
    );
  }

  for (const edge of MEN_PYRAMID_EDGES) {
    add(
      "INSERT INTO pyramid_edges (id, from_division_id, to_division_id, movement_type, slots) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET from_division_id = excluded.from_division_id, to_division_id = excluded.to_division_id, movement_type = excluded.movement_type, slots = excluded.slots",
      [edge.id, edge.from_division_id, edge.to_division_id, edge.movement_type, edge.slots]
    );
  }

  for (const season of MEN_PYRAMID_SEASONS) {
    add(
      "INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET template_id = excluded.template_id, season_label = excluded.season_label",
      [season.id, season.template_id, season.season_label]
    );
  }

  for (const seasonDivision of MEN_PYRAMID_SEASON_DIVISIONS) {
    add(
      "INSERT INTO pyramid_season_divisions (id, season_id, template_id, division_id, status, locked_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET season_id = excluded.season_id, template_id = excluded.template_id, division_id = excluded.division_id, status = excluded.status, locked_at = excluded.locked_at",
      [seasonDivision.id, seasonDivision.season_id, seasonDivision.template_id, seasonDivision.division_id, seasonDivision.status, seasonDivision.locked_at]
    );
  }

  for (const club of MEN_PYRAMID_CLUBS) {
    add(
      "INSERT INTO pyramid_clubs (id, name, aliases, league_name, source_url, verified_at, status) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, aliases = excluded.aliases, league_name = excluded.league_name, source_url = excluded.source_url, verified_at = excluded.verified_at, status = excluded.status",
      [club.id, club.name, club.aliases, club.league_name, club.source_url, club.verified_at, club.status]
    );
  }

  for (const c of SEED_DATA.competitions) {
    add(
      "INSERT INTO competitions (code, name, tier) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name, tier = excluded.tier",
      [c.code, c.name, c.tier]
    );
  }

  for (const v of SEED_DATA.venues) {
    add(
      "INSERT INTO venues (id, name, postcode, latitude, longitude) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, postcode = excluded.postcode, latitude = excluded.latitude, longitude = excluded.longitude",
      [v.id, v.name, v.postcode, v.latitude, v.longitude]
    );
  }

  for (const cl of SEED_DATA.clubs) {
    add(
      "INSERT INTO clubs (id, name, football_data_team_id, aliases, short_name, competition_code, venue_id, official_site_url, generic_ticket_url, price_source_url, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, football_data_team_id = excluded.football_data_team_id, aliases = excluded.aliases, short_name = excluded.short_name, competition_code = excluded.competition_code, venue_id = excluded.venue_id, official_site_url = excluded.official_site_url, generic_ticket_url = excluded.generic_ticket_url, price_source_url = excluded.price_source_url, verified_at = excluded.verified_at",
      [cl.id, cl.name, cl.football_data_team_id, cl.aliases, cl.short_name, cl.competition_code, cl.venue_id, cl.official_site_url, cl.generic_ticket_url, cl.price_source_url, cl.verified_at]
    );
  }

  for (const membership of MEN_PYRAMID_MEMBERSHIPS) {
    add(
      "INSERT INTO pyramid_season_memberships (id, season_id, template_id, season_division_id, club_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET season_id = excluded.season_id, template_id = excluded.template_id, season_division_id = excluded.season_division_id, club_id = excluded.club_id",
      [membership.id, membership.season_id, membership.template_id, membership.season_division_id, membership.club_id]
    );
  }

  for (const movement of MEN_PYRAMID_MOVEMENTS) {
    add(
      "INSERT INTO pyramid_movements (id, season_id, template_id, club_id, from_season_division_id, to_season_division_id, movement_type, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET season_id = excluded.season_id, template_id = excluded.template_id, club_id = excluded.club_id, from_season_division_id = excluded.from_season_division_id, to_season_division_id = excluded.to_season_division_id, movement_type = excluded.movement_type, note = excluded.note, created_at = excluded.created_at",
      [movement.id, movement.season_id, movement.template_id, movement.club_id, movement.from_season_division_id, movement.to_season_division_id, movement.movement_type, movement.note, movement.created_at]
    );
  }

  for (const p of SEED_DATA.club_ticket_prices) {
    add(
      "INSERT INTO club_ticket_prices (club_id, sale_mode, adult_price_pence, concession_price_pence, source_url, verified_at, confidence) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(club_id) DO UPDATE SET sale_mode = excluded.sale_mode, adult_price_pence = excluded.adult_price_pence, concession_price_pence = excluded.concession_price_pence, source_url = excluded.source_url, verified_at = excluded.verified_at, confidence = excluded.confidence",
      [p.club_id, p.sale_mode, p.adult_price_pence, p.concession_price_pence, p.source_url, p.verified_at, p.confidence]
    );
  }

  for (const f of SEED_DATA.fixtures) {
    add(
      "INSERT INTO fixtures (source, source_id, competition_code, home_club_id, away_club_id, venue_id, kickoff_at, status, is_demo_data, is_historical) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source, source_id) DO UPDATE SET competition_code = excluded.competition_code, home_club_id = excluded.home_club_id, away_club_id = excluded.away_club_id, venue_id = excluded.venue_id, kickoff_at = excluded.kickoff_at, status = excluded.status, is_demo_data = excluded.is_demo_data, is_historical = excluded.is_historical",
      [f.source, f.source_id, f.competition_code, f.home_club_id, f.away_club_id, f.venue_id, f.kickoff_at, f.status, f.is_demo_data, f.is_historical]
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
      [assignment.id, assignment.club_id, assignment.venue_id, assignment.effective_from, assignment.effective_to, assignment.is_primary]
    );
  }

  await binding.batch(statements);
}
