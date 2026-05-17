import { createD1AppDatabase, type AppDatabase, type D1DatabaseLike, type D1PreparedStatement } from "./adapter.ts";
import { schemaSql } from "./schema.ts";
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

export interface SeedData {
  competitions: Array<{ code: string; name: string; tier: number }>;
  venues: Array<{ id: number; name: string; postcode: string; latitude: number; longitude: number; is_approximate: number }>;
  clubs: Array<{ id: number; name: string; football_data_team_id: number; aliases: string; short_name: string; competition_code: string; venue_id: number; official_site_url: string; generic_ticket_url: string; price_source_url: string; verified_at: string }>;
  club_ticket_prices: Array<{ club_id: number; sale_mode: string; adult_price_pence: number; concession_price_pence: number; source_url: string; verified_at: string; confidence: string }>;
  fixtures: Array<{
    source: string;
    source_id: string;
    competition_code: string;
    home_club_id: number;
    away_club_id: number;
    venue_id: number;
    kickoff_at: string;
    fixture_date: string | null;
    kickoff_time: string | null;
    kickoff_time_status: string | null;
    season_label: string | null;
    status: string;
    is_demo_data: number;
    is_historical: number;
    home_one_off: number;
    away_one_off: number;
    confidence: string;
  }>;
  travel_cache: Array<{ postcode_district: string; venue_id: number; distance_miles: number; driving_minutes: number; public_transport_minutes: number; provider: string; calculated_at: string }>;
}

export const SEED_DATA: SeedData = {
  competitions: [
    { code: "PL", name: "Premier League", tier: 1 },
    { code: "ELC", name: "Championship", tier: 2 }
  ],
  venues: [
    { id: 1, name: "Stamford Bridge", postcode: "SW6 1HS", latitude: 51.4817, longitude: -0.191, is_approximate: 0 },
    { id: 2, name: "Loftus Road", postcode: "W12 7PJ", latitude: 51.509, longitude: -0.2321, is_approximate: 0 },
    { id: 3, name: "Emirates Stadium", postcode: "N5 1BU", latitude: 51.5549, longitude: -0.1084, is_approximate: 0 },
    { id: 4, name: "Old Trafford", postcode: "M16 0RA", latitude: 53.4631, longitude: -2.2913, is_approximate: 0 },
    { id: 5, name: "Carrow Road", postcode: "NR1 1JE", latitude: 52.6221, longitude: 1.3091, is_approximate: 0 },
    { id: 6, name: "St Andrew's", postcode: "B9 4RL", latitude: 52.4756, longitude: -1.8682, is_approximate: 0 },
    { id: 7, name: "Villa Park", postcode: "B6 6HE", latitude: 52.509, longitude: -1.885, is_approximate: 0 },
    { id: 8, name: "Dean Court", postcode: "BH7 7AF", latitude: 50.735, longitude: -1.838, is_approximate: 0 },
    { id: 9, name: "Brentford Community Stadium", postcode: "TW8 0RU", latitude: 51.491, longitude: -0.289, is_approximate: 0 },
    { id: 10, name: "Falmer Stadium", postcode: "BN1 9BL", latitude: 50.862, longitude: -0.083, is_approximate: 0 },
    { id: 11, name: "Turf Moor", postcode: "BB10 4BX", latitude: 53.789, longitude: -2.23, is_approximate: 0 },
    { id: 12, name: "Selhurst Park", postcode: "SE25 6PU", latitude: 51.398, longitude: -0.086, is_approximate: 0 },
    { id: 13, name: "Hill Dickinson Stadium", postcode: "L4 0TH", latitude: 53.425, longitude: -3.003, is_approximate: 0 },
    { id: 14, name: "Craven Cottage", postcode: "SW6 6HH", latitude: 51.475, longitude: -0.222, is_approximate: 0 },
    { id: 15, name: "Elland Road", postcode: "LS11 0ES", latitude: 53.778, longitude: -1.572, is_approximate: 0 },
    { id: 16, name: "Anfield", postcode: "L4 0TH", latitude: 53.431, longitude: -2.961, is_approximate: 0 },
    { id: 17, name: "City of Manchester Stadium", postcode: "M11 3FF", latitude: 53.483, longitude: -2.2, is_approximate: 0 },
    { id: 18, name: "St James' Park", postcode: "NE1 4ST", latitude: 54.975, longitude: -1.622, is_approximate: 0 },
    { id: 19, name: "City Ground", postcode: "NG2 5FJ", latitude: 52.94, longitude: -1.133, is_approximate: 0 },
    { id: 20, name: "Stadium of Light", postcode: "SR5 1SU", latitude: 54.914, longitude: -1.388, is_approximate: 0 },
    { id: 21, name: "Tottenham Hotspur Stadium", postcode: "N17 0AP", latitude: 51.603, longitude: -0.066, is_approximate: 0 },
    { id: 22, name: "London Stadium", postcode: "E20 2ST", latitude: 51.538, longitude: -0.017, is_approximate: 0 },
    { id: 23, name: "Molineux Stadium", postcode: "WV1 4QR", latitude: 52.59, longitude: -2.13, is_approximate: 0 },
    { id: 24, name: "Ewood Park", postcode: "BB2 4JF", latitude: 53.728, longitude: -2.489, is_approximate: 0 },
    { id: 25, name: "Ashton Gate", postcode: "BS3 2EJ", latitude: 51.44, longitude: -2.62, is_approximate: 0 },
    { id: 26, name: "The Valley", postcode: "SE7 8BL", latitude: 51.487, longitude: 0.037, is_approximate: 0 },
    { id: 27, name: "Coventry Building Society Arena", postcode: "CV6 6GE", latitude: 52.448, longitude: -1.496, is_approximate: 0 },
    { id: 28, name: "Pride Park", postcode: "DE24 8XL", latitude: 52.915, longitude: -1.447, is_approximate: 0 },
    { id: 29, name: "MKM Stadium", postcode: "HU3 6HU", latitude: 53.746, longitude: -0.368, is_approximate: 0 },
    { id: 30, name: "Portman Road", postcode: "IP1 2DA", latitude: 52.055, longitude: 1.145, is_approximate: 0 },
    { id: 31, name: "King Power Stadium", postcode: "LE2 7FL", latitude: 52.62, longitude: -1.142, is_approximate: 0 },
    { id: 32, name: "Riverside Stadium", postcode: "TS3 6RS", latitude: 54.578, longitude: -1.218, is_approximate: 0 },
    { id: 33, name: "The Den", postcode: "SE16 3LN", latitude: 51.486, longitude: -0.05, is_approximate: 0 },
    { id: 34, name: "Kassam Stadium", postcode: "OX4 4XP", latitude: 51.716, longitude: -1.208, is_approximate: 0 },
    { id: 35, name: "Fratton Park", postcode: "PO4 8RA", latitude: 50.796, longitude: -1.064, is_approximate: 0 },
    { id: 36, name: "Deepdale", postcode: "PR1 6RU", latitude: 53.772, longitude: -2.688, is_approximate: 0 },
    { id: 37, name: "Bramall Lane", postcode: "S2 4SU", latitude: 53.369, longitude: -1.471, is_approximate: 0 },
    { id: 38, name: "Hillsborough Stadium", postcode: "S6 1SW", latitude: 53.412, longitude: -1.501, is_approximate: 0 },
    { id: 39, name: "St Mary's Stadium", postcode: "SO14 5FP", latitude: 50.906, longitude: -1.391, is_approximate: 0 },
    { id: 40, name: "bet365 Stadium", postcode: "ST4 4EG", latitude: 52.988, longitude: -2.175, is_approximate: 0 },
    { id: 41, name: "Swansea.com Stadium", postcode: "SA1 2FA", latitude: 51.642, longitude: -3.935, is_approximate: 0 },
    { id: 42, name: "Vicarage Road", postcode: "WD18 0ER", latitude: 51.65, longitude: -0.402, is_approximate: 0 },
    { id: 43, name: "The Hawthorns", postcode: "B71 4LF", latitude: 52.509, longitude: -1.964, is_approximate: 0 },
    { id: 44, name: "Racecourse Ground", postcode: "LL11 2AH", latitude: 53.052, longitude: -3.005, is_approximate: 0 },
    { id: 45, name: "Plough Lane", postcode: "SW19 4RG", latitude: 51.425, longitude: -0.179, is_approximate: 0 },
    { id: 46, name: "Oakwell", postcode: "S71 1ET", latitude: 53.552, longitude: -1.467, is_approximate: 0 },
    { id: 47, name: "Bloomfield Road", postcode: "FY1 6JJ", latitude: 53.805, longitude: -3.048, is_approximate: 0 },
    { id: 48, name: "Toughsheet Community Stadium", postcode: "BL6 6JW", latitude: 53.58, longitude: -2.536, is_approximate: 0 },
    { id: 49, name: "Valley Parade", postcode: "BD8 7DY", latitude: 53.804, longitude: -1.759, is_approximate: 0 },
    { id: 50, name: "Pirelli Stadium", postcode: "DE13 0BH", latitude: 52.822, longitude: -1.627, is_approximate: 0 },
    { id: 51, name: "Cardiff City Stadium", postcode: "CF11 8AZ", latitude: 51.473, longitude: -3.203, is_approximate: 0 },
    { id: 52, name: "Eco-Power Stadium", postcode: "DN4 5JW", latitude: 53.51, longitude: -1.114, is_approximate: 0 },
    { id: 53, name: "St. James Park (Exeter)", postcode: "EX4 6PX", latitude: 50.73, longitude: -3.521, is_approximate: 0 },
    { id: 54, name: "Kirklees Stadium", postcode: "HD1 6PX", latitude: 53.655, longitude: -1.768, is_approximate: 0 },
    { id: 55, name: "Brisbane Road", postcode: "E10 5NF", latitude: 51.56, longitude: -0.013, is_approximate: 0 },
    { id: 56, name: "Sincil Bank", postcode: "LN5 8LD", latitude: 53.22, longitude: -0.54, is_approximate: 0 },
    { id: 57, name: "Kenilworth Road", postcode: "LU1 1DH", latitude: 51.884, longitude: -0.428, is_approximate: 0 },
    { id: 58, name: "Field Mill", postcode: "NG18 5DA", latitude: 53.138, longitude: -1.201, is_approximate: 0 },
    { id: 59, name: "Sixfields Stadium", postcode: "NN5 5QA", latitude: 52.235, longitude: -0.932, is_approximate: 0 },
    { id: 60, name: "London Road Stadium", postcode: "PE2 8AL", latitude: 52.565, longitude: -0.24, is_approximate: 0 },
    { id: 61, name: "Home Park", postcode: "PL2 3DQ", latitude: 50.388, longitude: -4.151, is_approximate: 0 },
    { id: 62, name: "Vale Park", postcode: "ST6 1AW", latitude: 53.049, longitude: -2.189, is_approximate: 0 },
    { id: 63, name: "Madejski Stadium", postcode: "RG2 0FL", latitude: 51.422, longitude: -0.983, is_approximate: 0 },
    { id: 64, name: "New York Stadium", postcode: "S60 1AH", latitude: 53.428, longitude: -1.362, is_approximate: 0 },
    { id: 65, name: "Broadhall Way", postcode: "SG2 8RH", latitude: 51.886, longitude: -0.19, is_approximate: 0 },
    { id: 66, name: "Edgeley Park", postcode: "SK3 9DD", latitude: 53.4, longitude: -2.167, is_approximate: 0 },
    { id: 67, name: "Brick Community Stadium", postcode: "WN5 0UZ", latitude: 53.548, longitude: -2.654, is_approximate: 0 },
    { id: 68, name: "Adams Park", postcode: "HP12 4HJ", latitude: 51.63, longitude: -0.8, is_approximate: 0 },
    { id: 69, name: "Crown Ground", postcode: "BB5 5BX", latitude: 53.765, longitude: -2.37, is_approximate: 0 },
    { id: 70, name: "The Hive Stadium", postcode: "HA8 5AU", latitude: 51.603, longitude: -0.292, is_approximate: 0 },
    { id: 71, name: "Holker Street", postcode: "LA13 9HJ", latitude: 54.12, longitude: -3.226, is_approximate: 0 },
    { id: 72, name: "Memorial Stadium", postcode: "BS7 0BF", latitude: 51.486, longitude: -2.583, is_approximate: 0 },
    { id: 73, name: "Hayes Lane", postcode: "BR2 9EH", latitude: 51.382, longitude: 0.018, is_approximate: 0 },
    { id: 74, name: "Abbey Stadium", postcode: "CB5 8LN", latitude: 52.212, longitude: 0.153, is_approximate: 0 },
    { id: 75, name: "Whaddon Road", postcode: "GL52 5NA", latitude: 51.907, longitude: -2.058, is_approximate: 0 },
    { id: 76, name: "SMH Group Stadium", postcode: "S41 8NZ", latitude: 53.258, longitude: -1.438, is_approximate: 0 },
    { id: 77, name: "Colchester Community Stadium", postcode: "CO4 5UP", latitude: 51.923, longitude: 0.897, is_approximate: 0 },
    { id: 78, name: "Broadfield Stadium", postcode: "RH11 9RX", latitude: 51.099, longitude: -0.195, is_approximate: 0 },
    { id: 79, name: "Gresty Road", postcode: "CW2 6EB", latitude: 53.088, longitude: -2.436, is_approximate: 0 },
    { id: 80, name: "Highbury Stadium", postcode: "FY7 6TX", latitude: 53.917, longitude: -3.021, is_approximate: 0 },
    { id: 81, name: "Priestfield Stadium", postcode: "ME7 4DD", latitude: 51.378, longitude: 0.561, is_approximate: 0 },
    { id: 82, name: "Blundell Park", postcode: "DN35 7PY", latitude: 53.57, longitude: -0.046, is_approximate: 0 },
    { id: 83, name: "Wetherby Road", postcode: "HG3 1SA", latitude: 53.991, longitude: -1.537, is_approximate: 0 },
    { id: 84, name: "Stadium MK", postcode: "MK1 1ST", latitude: 52.009, longitude: -0.733, is_approximate: 0 },
    { id: 85, name: "Rodney Parade", postcode: "NP19 0UU", latitude: 51.591, longitude: -2.994, is_approximate: 0 },
    { id: 86, name: "Meadow Lane", postcode: "NG2 3HJ", latitude: 52.932, longitude: -1.135, is_approximate: 0 },
    { id: 87, name: "Boundary Park", postcode: "OL1 2PA", latitude: 53.556, longitude: -2.119, is_approximate: 0 },
    { id: 88, name: "Moor Lane", postcode: "M7 3PZ", latitude: 53.5, longitude: -2.272, is_approximate: 0 },
    { id: 89, name: "New Meadow", postcode: "SY2 6AB", latitude: 52.68, longitude: -2.75, is_approximate: 0 },
    { id: 90, name: "County Ground", postcode: "SN1 2ED", latitude: 51.564, longitude: -1.771, is_approximate: 0 },
    { id: 91, name: "Prenton Park", postcode: "CH42 9QA", latitude: 53.373, longitude: -3.036, is_approximate: 0 },
    { id: 92, name: "Bescot Stadium", postcode: "WS1 4SA", latitude: 52.565, longitude: -1.991, is_approximate: 0 },
    { id: 93, name: "The Recreation Ground", postcode: "GU11 2TU", latitude: 51.241, longitude: -0.77, is_approximate: 0 },
    { id: 94, name: "Moss Lane", postcode: "WA15 8AP", latitude: 53.383, longitude: -2.332, is_approximate: 0 },
    { id: 95, name: "Meadow Park", postcode: "WD6 1EA", latitude: 51.671, longitude: -0.274, is_approximate: 0 },
    { id: 96, name: "Boston Community Stadium", postcode: "PE21 7JJ", latitude: 52.977, longitude: -0.032, is_approximate: 0 },
    { id: 97, name: "St. James Park (Brackley)", postcode: "NN13 6EJ", latitude: 52.029, longitude: -1.14, is_approximate: 0 },
    { id: 98, name: "Cressing Road", postcode: "CM7 3PS", latitude: 51.877, longitude: 0.548, is_approximate: 0 },
    { id: 99, name: "Brunton Park", postcode: "CA1 7TJ", latitude: 54.895, longitude: -2.93, is_approximate: 0 },
    { id: 100, name: "Ten Acres", postcode: "SO50 9HT", latitude: 50.946, longitude: -1.346, is_approximate: 0 },
    { id: 101, name: "The Shay", postcode: "HX1 2YS", latitude: 53.72, longitude: -1.867, is_approximate: 0 },
    { id: 102, name: "The New Lawn", postcode: "GL6 0FG", latitude: 51.706, longitude: -2.242, is_approximate: 0 },
    { id: 103, name: "Gateshead International Stadium", postcode: "NE11 0EH", latitude: 54.961, longitude: -1.605, is_approximate: 0 },
    { id: 104, name: "Victoria Park", postcode: "TS24 8BZ", latitude: 54.69, longitude: -1.22, is_approximate: 0 },
    { id: 105, name: "Mazuma Mobile Stadium", postcode: "LA4 4TB", latitude: 54.065, longitude: -2.87, is_approximate: 0 },
    { id: 106, name: "Spotland Stadium", postcode: "OL11 5DS", latitude: 53.619, longitude: -2.157, is_approximate: 0 },
    { id: 107, name: "Glanford Park", postcode: "DN15 8TD", latitude: 53.586, longitude: -0.693, is_approximate: 0 },
    { id: 108, name: "Damson Park", postcode: "B92 9EJ", latitude: 52.418, longitude: -1.768, is_approximate: 0 },
    { id: 109, name: "Roots Hall", postcode: "SS2 6NQ", latitude: 51.537, longitude: 0.724, is_approximate: 0 },
    { id: 110, name: "Gander Green Lane", postcode: "SM1 2EY", latitude: 51.365, longitude: -0.191, is_approximate: 0 },
    { id: 111, name: "The Lamb Ground", postcode: "B77 4EW", latitude: 52.874, longitude: -1.654, is_approximate: 0 },
    { id: 112, name: "Truro City Stadium", postcode: "TR1 2JF", latitude: 50.267, longitude: -5.053, is_approximate: 0 },
    { id: 113, name: "Grosvenor Vale", postcode: "HA5 3PP", latitude: 51.591, longitude: -0.378, is_approximate: 0 },
    { id: 114, name: "Kingfield Stadium", postcode: "GU22 9AA", latitude: 51.306, longitude: -0.563, is_approximate: 0 },
    { id: 115, name: "Huish Park", postcode: "BA22 8YF", latitude: 50.944, longitude: -2.652, is_approximate: 0 },
    { id: 116, name: "York Community Stadium", postcode: "YO32 9LL", latitude: 53.985, longitude: -1.053, is_approximate: 0 },
  
    { id: 117, name: "Mill Farm Sports Village", postcode: "PR4 3JZ", latitude: 53.776, longitude: -2.915, is_approximate: 0 },
    { id: 118, name: "New Bucks Head", postcode: "TF1 2TU", latitude: 52.697, longitude: -2.501, is_approximate: 0 },
    { id: 119, name: "North Street", postcode: "DE55 7FZ", latitude: 53.098, longitude: -1.385, is_approximate: 0 },
    { id: 120, name: "The Eyrie", postcode: "MK44 3TW", latitude: 52.15, longitude: -0.398, is_approximate: 0 },
    { id: 121, name: "The Silverlands", postcode: "SK17 6QH", latitude: 53.255, longitude: -1.916, is_approximate: 0 },
    { id: 122, name: "Deva Stadium", postcode: "CH1 4LT", latitude: 53.189, longitude: -2.924, is_approximate: 0 },
    { id: 123, name: "Victory Park", postcode: "PR7 3JP", latitude: 53.646, longitude: -2.629, is_approximate: 0 },
    { id: 124, name: "Tameside Stadium", postcode: "OL7 9HG", latitude: 53.49, longitude: -2.132, is_approximate: 0 },
    { id: 125, name: "Blackwell Meadows", postcode: "DL1 5NR", latitude: 54.53, longitude: -1.555, is_approximate: 0 },
    { id: 126, name: "Edgar Street", postcode: "HR4 9JU", latitude: 52.061, longitude: -2.718, is_approximate: 0 },
    { id: 127, name: "Aggborough", postcode: "DY10 1NA", latitude: 52.389, longitude: -2.248, is_approximate: 0 },
    { id: 128, name: "The Walks", postcode: "PE30 5PB", latitude: 52.75, longitude: 0.407, is_approximate: 0 },
    { id: 129, name: "New Windmill Ground", postcode: "CV31 2AF", latitude: 52.283, longitude: -1.532, is_approximate: 0 },
    { id: 130, name: "Moss Rose", postcode: "SK11 7SP", latitude: 53.243, longitude: -2.127, is_approximate: 0 },
    { id: 131, name: "Rossett Park", postcode: "L23 3AS", latitude: 53.498, longitude: -3.025, is_approximate: 0 },
    { id: 132, name: "Penydarren Park", postcode: "CF47 8RF", latitude: 51.751, longitude: -3.378, is_approximate: 0 },
    { id: 133, name: "Marsh Lane", postcode: "OX3 0NQ", latitude: 51.746, longitude: -1.213, is_approximate: 0 },
    { id: 134, name: "Lincoln Road", postcode: "PE1 2PR", latitude: 52.59, longitude: -0.227, is_approximate: 0 },
    { id: 135, name: "Stainton Park", postcode: "M26 3PE", latitude: 53.568, longitude: -2.341, is_approximate: 0 },
    { id: 136, name: "Scarborough Sports Village", postcode: "YO11 2JW", latitude: 54.27, longitude: -0.414, is_approximate: 0 },
    { id: 137, name: "Mariners Park", postcode: "NE34 9RX", latitude: 54.98, longitude: -1.419, is_approximate: 0 },
    { id: 138, name: "Haig Avenue", postcode: "PR8 6JZ", latitude: 53.638, longitude: -2.979, is_approximate: 0 },
    { id: 139, name: "The Brewery Field", postcode: "DL16 6JZ", latitude: 54.706, longitude: -1.607, is_approximate: 0 },
    { id: 140, name: "Sandy Lane", postcode: "S80 3BT", latitude: 53.314, longitude: -1.131, is_approximate: 0 },
    { id: 141, name: "Testwood Stadium", postcode: "SO40 3WY", latitude: 50.921, longitude: -1.496, is_approximate: 0 },
    { id: 142, name: "Twerton Park", postcode: "BA2 1DB", latitude: 51.379, longitude: -2.395, is_approximate: 0 },
    { id: 143, name: "Melbourne Stadium", postcode: "CM1 2HT", latitude: 51.732, longitude: 0.464, is_approximate: 0 },
    { id: 144, name: "The Meadow", postcode: "HP5 1NE", latitude: 51.706, longitude: -0.607, is_approximate: 0 },
    { id: 145, name: "Hardenhuish Park", postcode: "SN14 6LR", latitude: 51.462, longitude: -2.115, is_approximate: 0 },
    { id: 146, name: "Victoria Road", postcode: "RM10 7XL", latitude: 51.548, longitude: 0.16, is_approximate: 0 },
    { id: 147, name: "Meadowbank Stadium", postcode: "RH4 1DG", latitude: 51.247, longitude: -0.328, is_approximate: 0 },
    { id: 148, name: "Crabble Athletic Ground", postcode: "CT17 0JB", latitude: 51.126, longitude: 1.316, is_approximate: 0 },
    { id: 149, name: "Priory Lane", postcode: "BN23 7QH", latitude: 50.804, longitude: 0.321, is_approximate: 0 },
    { id: 150, name: "Stonebridge Road", postcode: "DA11 9BD", latitude: 51.449, longitude: 0.322, is_approximate: 0 },
    { id: 151, name: "Queen Elizabeth II Stadium", postcode: "EN3 6SA", latitude: 51.662, longitude: -0.035, is_approximate: 0 },
    { id: 152, name: "Cherrywood Road", postcode: "GU14 8UD", latitude: 51.311, longitude: -0.762, is_approximate: 0 },
    { id: 153, name: "Beveree Stadium", postcode: "TW12 2BX", latitude: 51.416, longitude: -0.369, is_approximate: 0 },
    { id: 154, name: "Vauxhall Road", postcode: "HP2 4HW", latitude: 51.754, longitude: -0.467, is_approximate: 0 },
    { id: 155, name: "Hornchurch Stadium", postcode: "RM14 2DH", latitude: 51.557, longitude: 0.238, is_approximate: 0 },
    { id: 156, name: "Hop Oast Stadium", postcode: "RH13 0GR", latitude: 51.078, longitude: -0.333, is_approximate: 0 },
    { id: 157, name: "York Road", postcode: "SL6 1SF", latitude: 51.52, longitude: -0.718, is_approximate: 0 },
    { id: 158, name: "Gallagher Stadium", postcode: "ME14 1LQ", latitude: 51.28, longitude: 0.526, is_approximate: 0 },
    { id: 159, name: "Raymond McEnhill Stadium", postcode: "SP4 6PU", latitude: 51.104, longitude: -1.786, is_approximate: 0 },
    { id: 160, name: "Arbour Park", postcode: "SL1 2HJ", latitude: 51.508, longitude: -0.599, is_approximate: 0 },
    { id: 161, name: "Longmead Stadium", postcode: "TN10 3NU", latitude: 51.212, longitude: 0.269, is_approximate: 0 },
    { id: 162, name: "Plainmoor", postcode: "TQ1 3PS", latitude: 50.476, longitude: -3.524, is_approximate: 0 },
    { id: 163, name: "Woodspring Stadium", postcode: "BS24 9BX", latitude: 51.34, longitude: -2.961, is_approximate: 0 },
    { id: 164, name: "Woodside Road", postcode: "BN14 7HQ", latitude: 50.821, longitude: -0.385, is_approximate: 0 },
    { id: 165, name: "Abbey Stadium", postcode: "", latitude: 52.2121, longitude: 0.15415, is_approximate: 1 },
    { id: 166, name: "Rossett Park", postcode: "L23 3AS", latitude: 53.498, longitude: -3.025, is_approximate: 1 },
    { id: 167, name: "Crilly Park", postcode: "", latitude: 53.522, longitude: -2.494, is_approximate: 1 },
    { id: 168, name: "Greenberfield Lane", postcode: "", latitude: 53.926, longitude: -2.187, is_approximate: 1 },
    { id: 169, name: "Community Stadium", postcode: "", latitude: 53.588, longitude: -2.854, is_approximate: 1 },
    { id: 170, name: "Andrew Street", postcode: "", latitude: 53.545, longitude: -2.14, is_approximate: 1 },
    { id: 171, name: "Mossie Park", postcode: "", latitude: 53.637, longitude: -2.657, is_approximate: 1 },
    { id: 172, name: "Park Road Stadium", postcode: "", latitude: 53.39216, longitude: -2.20338, is_approximate: 1 },
    { id: 173, name: "DCBL Stadium", postcode: "WA14 5SZ", latitude: 53.432, longitude: -2.686, is_approximate: 1 },
    { id: 174, name: "Jim Fowler Memorial Ground", postcode: "", latitude: 53.661, longitude: -2.681, is_approximate: 1 },
    { id: 175, name: "The Bowl", postcode: "", latitude: 54.162, longitude: -4.482, is_approximate: 1 },
    { id: 176, name: "Windleshaw Sports", postcode: "", latitude: 53.447, longitude: -2.78, is_approximate: 1 },
    { id: 177, name: "The Amdec Forklift Stadium", postcode: "", latitude: 53.444, longitude: -1.956, is_approximate: 1 },
    { id: 178, name: "Silver Street", postcode: "", latitude: 53.448, longitude: -2.383, is_approximate: 1 },
    { id: 179, name: "Litherland Sports Park", postcode: "", latitude: 53.468, longitude: -2.997, is_approximate: 1 },
    { id: 180, name: "Mike Riding Ground", postcode: "", latitude: 53.825, longitude: -2.617, is_approximate: 1 },
    { id: 181, name: "Arbories Memorial Sports Ground", postcode: "", latitude: 53.801, longitude: -2.31, is_approximate: 1 },
    { id: 182, name: "Ruskin Drive Sports Ground", postcode: "", latitude: 53.459, longitude: -2.735, is_approximate: 1 },
    { id: 183, name: "Adie Moran Park", postcode: "", latitude: 53.527, longitude: -2.289, is_approximate: 1 },
    { id: 184, name: "The Harry Williams Riverside", postcode: "", latitude: 53.649, longitude: -2.319, is_approximate: 1 },
    { id: 185, name: "Jericho Lane", postcode: "", latitude: 53.35, longitude: -2.897, is_approximate: 1 },
    { id: 186, name: "Stockport Sports Village", postcode: "", latitude: 53.418, longitude: -2.097, is_approximate: 1 },
    { id: 187, name: "Brookburn Road", postcode: "M21 8FE", latitude: 53.442, longitude: -2.264, is_approximate: 1 },
    { id: 188, name: "Hollyhedge Park", postcode: "M22 9UN", latitude: 53.388, longitude: -2.277, is_approximate: 1 },
    { id: 189, name: "The Mechanics", postcode: "", latitude: 53.773, longitude: -3.036, is_approximate: 1 },
    { id: 190, name: "Brocstedes Park", postcode: "", latitude: 53.521, longitude: -2.626, is_approximate: 1 },
    { id: 191, name: "Edge Green Street", postcode: "", latitude: 53.524, longitude: -2.625, is_approximate: 1 },
    { id: 192, name: "West View", postcode: "", latitude: 53.702, longitude: -2.227, is_approximate: 1 },
    { id: 193, name: "The Heath", postcode: "", latitude: 53.406, longitude: -2.177, is_approximate: 1 },
    { id: 194, name: "Holt House", postcode: "", latitude: 53.852, longitude: -2.186, is_approximate: 1 },
    { id: 195, name: "New Sirs", postcode: "", latitude: 53.549, longitude: -2.52, is_approximate: 1 },
    { id: 196, name: "WEC Group Anchor Ground", postcode: "", latitude: 53.698, longitude: -2.462, is_approximate: 1 },
    { id: 197, name: "Butcher's Arms Ground", postcode: "M43 6UL", latitude: 53.481, longitude: -2.15, is_approximate: 1 },
    { id: 198, name: "Lightfoot Green", postcode: "", latitude: 53.792, longitude: -2.7, is_approximate: 1 },
    { id: 199, name: "The Riverside", postcode: "", latitude: 53.904, longitude: -2.77, is_approximate: 1 },
    { id: 200, name: "Rakesmoor", postcode: "", latitude: 54.117, longitude: -3.22, is_approximate: 1 },
    { id: 201, name: "Old Hall Field", postcode: "", latitude: 53.549, longitude: -2.919, is_approximate: 1 },
    { id: 202, name: "Brantingham Road", postcode: "", latitude: 53.448, longitude: -2.277, is_approximate: 1 },
    { id: 203, name: "Victoria Park", postcode: "", latitude: 53.835, longitude: -2.215, is_approximate: 1 },
    { id: 204, name: "Brian Addison Stadium", postcode: "", latitude: 53.773, longitude: -3.037, is_approximate: 1 },
    { id: 205, name: "Marley Stadium", postcode: "", latitude: 53.904, longitude: -1.945, is_approximate: 1 },
    { id: 206, name: "Gamble Road", postcode: "", latitude: 53.877, longitude: -3.038, is_approximate: 1 },
    { id: 207, name: "Allscott Sports & Social Club", postcode: "", latitude: 52.717, longitude: -2.566, is_approximate: 1 },
    { id: 208, name: "Wood Park Stadium", postcode: "", latitude: 53.098, longitude: -2.306, is_approximate: 1 },
    { id: 209, name: "Ray Parker Stadium", postcode: "", latitude: 53.414, longitude: -3.031, is_approximate: 1 },
    { id: 210, name: "Creative Hut Stadium", postcode: "", latitude: 53.271, longitude: -2.556, is_approximate: 1 },
    { id: 211, name: "Kirklands", postcode: "", latitude: 53.363, longitude: -3.011, is_approximate: 1 },
    { id: 212, name: "Pershall Park", postcode: "", latitude: 52.857, longitude: -2.248, is_approximate: 1 },
    { id: 213, name: "Whitcombe Road", postcode: "", latitude: 52.929, longitude: -2.111, is_approximate: 1 },
    { id: 214, name: "Shrewsbury Sports Village", postcode: "SY3 6AB", latitude: 52.712, longitude: -2.761, is_approximate: 1 },
    { id: 215, name: "Greenfields Sports Ground", postcode: "", latitude: 52.907, longitude: -2.486, is_approximate: 1 },
    { id: 216, name: "Camp Hill & Simpson Ground", postcode: "", latitude: 53.373, longitude: -2.875, is_approximate: 1 },
    { id: 217, name: "Church Lane", postcode: "", latitude: 53.365, longitude: -2.002, is_approximate: 1 },
    { id: 218, name: "Viridor Community Stadium", postcode: "", latitude: 53.338, longitude: -2.71, is_approximate: 1 },
    { id: 219, name: "Sandbach Community Football Centre", postcode: "", latitude: 53.145, longitude: -2.38, is_approximate: 1 },
    { id: 220, name: "New Meadow", postcode: "SY2 6AB", latitude: 52.689, longitude: -2.752, is_approximate: 1 },
    { id: 221, name: "Evans Park", postcode: "", latitude: 52.801, longitude: -2.117, is_approximate: 1 },
    { id: 222, name: "Cromley Road", postcode: "", latitude: 53.423, longitude: -2.13, is_approximate: 1 },
    { id: 223, name: "DRM Aggregates Arena", postcode: "", latitude: 52.685, longitude: -2.465, is_approximate: 1 },
    { id: 224, name: "Brinsford Lane", postcode: "", latitude: 52.645, longitude: -2.089, is_approximate: 1 },
    { id: 225, name: "Pride Park", postcode: "", latitude: 52.627, longitude: -2.131, is_approximate: 1 },
    // ── Level 7 venues ───────────────────────────────────────────────
    { id: 226, name: "Hurst Cross", postcode: "OL6 8DZ", latitude: 53.50139, longitude: -2.07972, is_approximate: 0 },
    { id: 227, name: "Irongate", postcode: "PR5 8DJ", latitude: 53.72778, longitude: -2.67194, is_approximate: 0 },
    { id: 228, name: "Linden Club", postcode: "DN31 2NL", latitude: 53.55538, longitude: -0.05557, is_approximate: 0 },
    { id: 229, name: "Broadhurst Park", postcode: "M40 0FJ", latitude: 53.51667, longitude: -2.18028, is_approximate: 0 },
    { id: 230, name: "The Northolme", postcode: "DN21 2FD", latitude: 53.40343, longitude: -0.77450, is_approximate: 0 },
    { id: 231, name: "Nethermoor Park", postcode: "LS20 8FB", latitude: 53.87727, longitude: -1.71933, is_approximate: 0 },
    { id: 232, name: "The Green Energy Sports Ground", postcode: "NE31 1UN", latitude: 54.96861, longitude: -1.52389, is_approximate: 0 },
    { id: 233, name: "Keys Park", postcode: "WS12 2DZ", latitude: 52.69778, longitude: -1.98901, is_approximate: 0 },
    { id: 234, name: "Ewen Fields", postcode: "SK14 5PL", latitude: 53.45038, longitude: -2.06800, is_approximate: 0 },
    { id: 235, name: "New Manor Ground", postcode: "DE7 8JF", latitude: 52.98389, longitude: -1.30028, is_approximate: 0 },
    { id: 236, name: "The Giant Axe", postcode: "LA1 1DQ", latitude: 54.05111, longitude: -2.81111, is_approximate: 0 },
    { id: 237, name: "Harrison Park", postcode: "ST13 8LD", latitude: 53.10972, longitude: -2.03972, is_approximate: 0 },
    { id: 238, name: "Craik Park", postcode: "NE61 2NS", latitude: 55.15611, longitude: -1.70861, is_approximate: 0 },
    { id: 239, name: "IP Truck Parts Stadium", postcode: "L34 1LA", latitude: 53.43194, longitude: -2.80472, is_approximate: 0 },
    { id: 240, name: "Dales Lane", postcode: "WS4 1LJ", latitude: 52.60087, longitude: -1.95227, is_approximate: 0 },
    { id: 241, name: "Bracken Moor", postcode: "S36 2AN", latitude: 53.47722, longitude: -1.58694, is_approximate: 0 },
    { id: 242, name: "Bishopton Road West", postcode: "TS19 0QD", latitude: 54.57056, longitude: -1.33972, is_approximate: 0 },
    { id: 243, name: "Gorsey Lane", postcode: "WA2 7AF", latitude: 53.40000, longitude: -2.57600, is_approximate: 0 },
    { id: 244, name: "Cantilever Park", postcode: "WA2 7AE", latitude: 53.37703, longitude: -2.56993, is_approximate: 0 },
    { id: 245, name: "Turnbull Ground", postcode: "YO21 3DU", latitude: 54.49000, longitude: -0.62750, is_approximate: 0 },
    { id: 246, name: "Borough Park", postcode: "CA14 2DT", latitude: 54.64876, longitude: -3.55110, is_approximate: 0 },
    { id: 247, name: "Parkside", postcode: "RM15 4RU", latitude: 51.50350, longitude: 0.26130, is_approximate: 0 },
    { id: 248, name: "New Lodge", postcode: "CM12 0SA", latitude: 51.62167, longitude: 0.40333, is_approximate: 0 },
    { id: 249, name: "Brentwood Centre Arena", postcode: "CM15 9NN", latitude: 51.63389, longitude: 0.30056, is_approximate: 0 },
    { id: 250, name: "Leylands Park", postcode: "BN15 8RG", latitude: 50.96694, longitude: -0.12472, is_approximate: 0 },
    { id: 251, name: "Park Lane", postcode: "SS8 0QY", latitude: 51.51639, longitude: 0.61556, is_approximate: 0 },
    { id: 252, name: "War Memorial Sports Ground", postcode: "SM5 2PW", latitude: 51.36970, longitude: -0.17181, is_approximate: 0 },
    { id: 253, name: "The Bauvill Stadium", postcode: "ME4 6LL", latitude: 51.36860, longitude: 0.52140, is_approximate: 0 },
    { id: 254, name: "Theobalds Lane", postcode: "EN8 8RU", latitude: 51.69440, longitude: -0.04166, is_approximate: 0 },
    { id: 255, name: "Oaklands Park", postcode: "PO19 6AR", latitude: 50.84251, longitude: -0.77541, is_approximate: 0 },
    { id: 256, name: "Badgers Sports Ground", postcode: "SE9 3PA", latitude: 51.45056, longitude: 0.03472, is_approximate: 0 },
    { id: 257, name: "Flamingo Park", postcode: "BR7 6NR", latitude: 51.41902, longitude: 0.10997, is_approximate: 0 },
    { id: 258, name: "Princes Park", postcode: "DA1 1LZ", latitude: 51.43662, longitude: 0.23030, is_approximate: 0 },
    { id: 259, name: "Champion Hill", postcode: "SE22 8DJ", latitude: 51.46131, longitude: -0.08396, is_approximate: 0 },
    { id: 260, name: "Cheriton Road", postcode: "CT19 4JU", latitude: 51.08656, longitude: 1.15945, is_approximate: 0 },
    { id: 262, name: "The Dripping Pan", postcode: "BN7 2UX", latitude: 50.86901, longitude: 0.01227, is_approximate: 0 },
    { id: 263, name: "Parkfield", postcode: "EN6 1PY", latitude: 51.69611, longitude: -0.17750, is_approximate: 0 },
    { id: 264, name: "Southwood Stadium", postcode: "CT11 0AN", latitude: 51.33276, longitude: 1.39974, is_approximate: 0 },
    { id: 265, name: "Clarence Park", postcode: "AL1 4NF", latitude: 51.75329, longitude: -0.32406, is_approximate: 0 },
    { id: 266, name: "Park View Road", postcode: "DA16 1SL", latitude: 51.46036, longitude: 0.11654, is_approximate: 0 },
    { id: 267, name: "The Enclosed Ground", postcode: "BN2 5DS", latitude: 50.82141, longitude: -0.09614, is_approximate: 0 },
    { id: 268, name: "The Maurice Rebak Stadium", postcode: "N3 2ES", latitude: 51.60685, longitude: -0.17154, is_approximate: 0 },
    { id: 269, name: "King's Marsh", postcode: "CO10 2AW", latitude: 52.04015, longitude: 0.71616, is_approximate: 0 },
    { id: 270, name: "Lye Meadow", postcode: "B48 7LZ", latitude: 52.34484, longitude: -1.95631, is_approximate: 0 },
    { id: 271, name: "Spencer Stadium", postcode: "OX16 2QD", latitude: 52.05679, longitude: -1.32581, is_approximate: 0 },
    { id: 272, name: "Kirkby Road", postcode: "LE9 8FQ", latitude: 52.57270, longitude: -1.34120, is_approximate: 0 },
    { id: 273, name: "Woodside Park", postcode: "CM23 5RG", latitude: 51.87250, longitude: 0.19194, is_approximate: 0 },
    { id: 274, name: "Victoria Ground", postcode: "B61 0DW", latitude: 52.33962, longitude: -2.05642, is_approximate: 0 },
    { id: 275, name: "Ram Meadow", postcode: "IP33 1TH", latitude: 52.24888, longitude: 0.72106, is_approximate: 0 },
    { id: 276, name: "The Grove", postcode: "B63 4AA", latitude: 52.45384, longitude: -2.05771, is_approximate: 0 },
    { id: 277, name: "Bowden Park", postcode: "LE16 7TU", latitude: 52.46540, longitude: -0.91800, is_approximate: 0 },
    { id: 278, name: "Latimer Park", postcode: "NN15 5AG", latitude: 52.36680, longitude: -0.68933, is_approximate: 0 },
    { id: 279, name: "Victory Road", postcode: "IP16 4DQ", latitude: 52.20440, longitude: 1.57143, is_approximate: 0 },
    { id: 280, name: "Bloomfields", postcode: "IP6 8EJ", latitude: 52.15073, longitude: 1.04464, is_approximate: 0 },
    { id: 281, name: "Farley Way Stadium", postcode: "LE12 8BT", latitude: 52.74884, longitude: -1.18028, is_approximate: 0 },
    { id: 282, name: "McMullen Park", postcode: "MK42 0EY", latitude: 52.12778, longitude: -0.41500, is_approximate: 0 },
    { id: 283, name: "The Valley", postcode: "B97 4AW", latitude: 52.30780, longitude: -1.95160, is_approximate: 0 },
    { id: 284, name: "Garden Walk", postcode: "SG8 7HP", latitude: 52.05267, longitude: -0.01676, is_approximate: 0 },
    { id: 285, name: "Sir Halley Stewart Field", postcode: "PE11 1DA", latitude: 52.79001, longitude: -0.15254, is_approximate: 0 },
    { id: 286, name: "Westwood Road", postcode: "PE27 6JS", latitude: 52.33042, longitude: -0.08216, is_approximate: 0 },
    { id: 287, name: "Borderville Sports Centre", postcode: "PE9 2NR", latitude: 52.66558, longitude: -0.46892, is_approximate: 0 },
    { id: 288, name: "War Memorial Athletic Ground", postcode: "DY8 4HN", latitude: 52.46301, longitude: -2.15043, is_approximate: 0 },
    { id: 289, name: "Knights Lane", postcode: "CV37 0JA", latitude: 52.19417, longitude: -1.67639, is_approximate: 0 },
    { id: 290, name: "Sixways Stadium", postcode: "WR3 8ZE", latitude: 52.22470, longitude: -2.21210, is_approximate: 0 },
    { id: 291, name: "Winklebury Football Complex", postcode: "RG23 8BF", latitude: 51.26793, longitude: -1.11191, is_approximate: 0 },
    { id: 292, name: "Broadwater", postcode: "HP4 1DQ", latitude: 51.76317, longitude: -0.56474, is_approximate: 0 },
    { id: 293, name: "Bottom Meadow", postcode: "GU47 0TH", latitude: 51.34223, longitude: -0.79342, is_approximate: 0 },
    { id: 294, name: "Alwyns Lane", postcode: "KT16 9DW", latitude: 51.39250, longitude: -0.50806, is_approximate: 0 },
    { id: 295, name: "The Avenue Stadium", postcode: "DT1 2RU", latitude: 50.70060, longitude: -2.44564, is_approximate: 0 },
    { id: 296, name: "Jubilee Stadium", postcode: "WR11 1JG", latitude: 52.07361, longitude: -1.95469, is_approximate: 0 },
    { id: 297, name: "The Memorial Ground", postcode: "GU9 8DN", latitude: 51.21139, longitude: -0.80639, is_approximate: 0 },
    { id: 298, name: "Meadow Park", postcode: "GL4 6NZ", latitude: 51.83307, longitude: -2.21160, is_approximate: 0 },
    { id: 299, name: "Privett Park", postcode: "PO12 3RP", latitude: 50.79492, longitude: -1.15656, is_approximate: 0 },
    { id: 300, name: "Powerday Stadium", postcode: "UB6 8LF", latitude: 51.53252, longitude: -0.32895, is_approximate: 0 },
    { id: 301, name: "Westleigh Park", postcode: "PO9 5TH", latitude: 50.86708, longitude: -0.97414, is_approximate: 0 },
    { id: 302, name: "Bulpit Lane", postcode: "RG17 0EL", latitude: 51.40894, longitude: -1.51348, is_approximate: 0 },
    { id: 303, name: "Bolitho Park", postcode: "PL5 4JF", latitude: 50.40785, longitude: -4.14736, is_approximate: 0 },
    { id: 304, name: "Tatnam Ground", postcode: "BH15 3JU", latitude: 50.72826, longitude: -1.98432, is_approximate: 0 },
    { id: 305, name: "Universal Stadium", postcode: "SO19 8PW", latitude: 50.89326, longitude: -1.33812, is_approximate: 0 },
    { id: 306, name: "Wordsworth Drive", postcode: "TA1 4DQ", latitude: 51.01673, longitude: -3.08510, is_approximate: 0 },
    { id: 307, name: "Ladysmead", postcode: "EX16 6NR", latitude: 50.90925, longitude: -3.49017, is_approximate: 0 },
    { id: 308, name: "Honeycroft", postcode: "UB7 8DD", latitude: 51.51406, longitude: -0.45770, is_approximate: 0 },
    { id: 309, name: "Elmbridge Sports Hub", postcode: "KT12 2JP", latitude: 51.39940, longitude: -0.41226, is_approximate: 0 },
    { id: 310, name: "Bob Lucas Stadium", postcode: "DT4 9XD", latitude: 50.62037, longitude: -2.48568, is_approximate: 0 },
    { id: 311, name: "The Cuthbury", postcode: "BH21 1HD", latitude: 50.80165, longitude: -1.99668, is_approximate: 0 },
    { id: 312, name: "Lodge Road", postcode: "BS37 5LE", latitude: 51.54933, longitude: -2.43870, is_approximate: 0 },
    // ── Level 8 venues ───────────────────────────────────────────────
    { id: 313, name: "Woodhorn Lane", postcode: "", latitude: 55.18520, longitude: -1.55050, is_approximate: 0 },
    { id: 314, name: "Heritage Park", postcode: "", latitude: 54.63810, longitude: -1.69360, is_approximate: 0 },
    { id: 315, name: "Croft Park", postcode: "", latitude: 55.12710, longitude: -1.51000, is_approximate: 0 },
    { id: 316, name: "South Newsham Playing Fields", postcode: "", latitude: 55.10580, longitude: -1.51940, is_approximate: 0 },
    { id: 317, name: "Horsfall Stadium", postcode: "", latitude: 53.75890, longitude: -1.77610, is_approximate: 0 },
    { id: 318, name: "Queensgate", postcode: "", latitude: 54.08220, longitude: -0.19090, is_approximate: 0 },
    { id: 319, name: "St Giles Road", postcode: "", latitude: 53.71970, longitude: -1.80020, is_approximate: 0 },
    { id: 320, name: "Belle View Stadium", postcode: "", latitude: 54.85030, longitude: -1.82380, is_approximate: 0 },
    { id: 321, name: "Wellington Road", postcode: "", latitude: 54.95390, longitude: -1.64590, is_approximate: 0 },
    { id: 322, name: "Fantastic Media Welfare Ground", postcode: "", latitude: 53.61260, longitude: -1.63190, is_approximate: 0 },
    { id: 323, name: "Wheatley Park", postcode: "", latitude: 53.79050, longitude: -1.39250, is_approximate: 0 },
    { id: 324, name: "Bradley Football Centre", postcode: "", latitude: 53.56710, longitude: -0.07880, is_approximate: 0 },
    { id: 325, name: "Sandygate", postcode: "", latitude: 53.37540, longitude: -1.53830, is_approximate: 0 },
    { id: 326, name: "The Willow Park", postcode: "", latitude: 54.99900, longitude: -1.59050, is_approximate: 0 },
    { id: 327, name: "Ashby Avenue", postcode: "", latitude: 53.22800, longitude: -0.53800, is_approximate: 1 },
    { id: 328, name: "Causeway Lane", postcode: "", latitude: 53.13680, longitude: -1.55240, is_approximate: 0 },
    { id: 329, name: "Moore Lane", postcode: "", latitude: 54.62190, longitude: -1.56640, is_approximate: 0 },
    { id: 330, name: "The Dransfield Stadium", postcode: "", latitude: 53.71920, longitude: -0.50520, is_approximate: 0 },
    { id: 331, name: "Ingfield", postcode: "", latitude: 53.67810, longitude: -1.57660, is_approximate: 0 },
    { id: 332, name: "Harratt Nissan Stadium", postcode: "", latitude: 53.69170, longitude: -1.31060, is_approximate: 0 },
    { id: 333, name: "Green Lane", postcode: "", latitude: 54.61790, longitude: -1.06880, is_approximate: 0 },
    { id: 334, name: "Keighley Road Stadium", postcode: "", latitude: 53.91320, longitude: -1.93750, is_approximate: 0 },
    { id: 335, name: "Hayden Road", postcode: "", latitude: 52.29120, longitude: -0.59880, is_approximate: 1 },
    { id: 336, name: "Cropston Road", postcode: "", latitude: 52.67320, longitude: -1.19580, is_approximate: 1 },
    { id: 337, name: "Greenwich Avenue", postcode: "", latitude: 52.95340, longitude: -1.14960, is_approximate: 1 },
    { id: 338, name: "The Oval", postcode: "", latitude: 52.47930, longitude: -1.46630, is_approximate: 1 },
    { id: 339, name: "Christchurch Meadow", postcode: "", latitude: 53.02290, longitude: -1.48170, is_approximate: 1 },
    { id: 340, name: "Trevor Brown Memorial Ground", postcode: "", latitude: 52.56230, longitude: -1.82400, is_approximate: 1 },
    { id: 341, name: "Abbey Lawn", postcode: "", latitude: 52.76820, longitude: -0.37720, is_approximate: 1 },
    { id: 342, name: "Bill Stokeld Stadium", postcode: "", latitude: 52.97570, longitude: -1.06820, is_approximate: 1 },
    { id: 343, name: "Pack Meadow", postcode: "", latitude: 51.64800, longitude: -0.63280, is_approximate: 1 },
    { id: 344, name: "Steel Park", postcode: "", latitude: 52.48770, longitude: -0.70330, is_approximate: 1 },
    { id: 345, name: "Sphinx Drive", postcode: "", latitude: 52.40820, longitude: -1.51050, is_approximate: 1 },
    { id: 346, name: "City Ground", postcode: "", latitude: 52.68060, longitude: -1.82440, is_approximate: 1 },
    { id: 347, name: "Grange Park", postcode: "", latitude: 52.89860, longitude: -1.27080, is_approximate: 1 },
    { id: 348, name: "Loughborough University Stadium", postcode: "", latitude: 52.77240, longitude: -1.20780, is_approximate: 1 },
    { id: 349, name: "Station Road", postcode: "", latitude: 52.90720, longitude: -1.54350, is_approximate: 0 },
    { id: 350, name: "Townsend Meadow", postcode: "", latitude: 52.28150, longitude: -1.58160, is_approximate: 1 },
    { id: 351, name: "Kilsby Lane", postcode: "", latitude: 52.37270, longitude: -1.26200, is_approximate: 1 },
    { id: 352, name: "Butlin Road", postcode: "", latitude: 52.37270, longitude: -1.26200, is_approximate: 1 },
    { id: 353, name: "The Dovecote Stadium", postcode: "", latitude: 52.75970, longitude: -1.30280, is_approximate: 1 },
    { id: 354, name: "New Rowley Park", postcode: "", latitude: 52.22760, longitude: -0.27040, is_approximate: 1 },
    { id: 355, name: "Coles Lane", postcode: "", latitude: 52.56230, longitude: -1.82400, is_approximate: 1 },
    { id: 356, name: "Dog & Duck Football Ground", postcode: "", latitude: 52.30190, longitude: -0.69370, is_approximate: 1 },
    { id: 357, name: "Alder Street", postcode: "", latitude: 53.52500, longitude: -2.49060, is_approximate: 1 },
    { id: 358, name: "Whitebank Stadium", postcode: "", latitude: 53.54400, longitude: -2.11800, is_approximate: 1 },
    { id: 359, name: "New Bucks Park", postcode: "", latitude: 53.45070, longitude: -2.99490, is_approximate: 1 },
    { id: 360, name: "Gigg Lane", postcode: "", latitude: 53.58060, longitude: -2.29490, is_approximate: 0 },
    { id: 361, name: "The Scholars Ground", postcode: "", latitude: 52.67400, longitude: -1.92100, is_approximate: 1 },
    { id: 362, name: "EcoGiants Stadium", postcode: "", latitude: 53.87170, longitude: -2.39270, is_approximate: 1 },
    { id: 363, name: "Cleric Stadium", postcode: "", latitude: 53.16350, longitude: -2.21080, is_approximate: 1 },
    { id: 364, name: "The Paycare Ground", postcode: "", latitude: 52.57580, longitude: -2.02040, is_approximate: 1 },
    { id: 365, name: "The Autonet Insurance Stadium", postcode: "", latitude: 53.08780, longitude: -2.23850, is_approximate: 1 },
    { id: 366, name: "Anfield Sports and Community Centre", postcode: "", latitude: 53.39330, longitude: -2.91660, is_approximate: 1 },
    { id: 367, name: "Seel Park", postcode: "", latitude: 53.51310, longitude: -2.03580, is_approximate: 1 },
    { id: 368, name: "The Weaver Stadium", postcode: "", latitude: 53.06710, longitude: -2.52210, is_approximate: 1 },
    { id: 369, name: "Lyme Valley Stadium", postcode: "", latitude: 53.01090, longitude: -2.22710, is_approximate: 1 },
    { id: 370, name: "APEC Taxis Stadium", postcode: "", latitude: 53.34220, longitude: -2.73350, is_approximate: 1 },
    { id: 371, name: "Acoustafoam Stadium", postcode: "", latitude: 52.66760, longitude: -2.37300, is_approximate: 1 },
    { id: 372, name: "Aspray Arena", postcode: "", latitude: 52.58480, longitude: -2.05350, is_approximate: 1 },
    { id: 373, name: "Marston Road", postcode: "", latitude: 52.80700, longitude: -2.11600, is_approximate: 1 },
    { id: 374, name: "Bower Fold", postcode: "", latitude: 53.48400, longitude: -2.05630, is_approximate: 0 },
    { id: 375, name: "Shawe View", postcode: "", latitude: 53.44370, longitude: -2.38400, is_approximate: 1 },
    { id: 376, name: "Rivacre Park", postcode: "", latitude: 53.27890, longitude: -2.90230, is_approximate: 1 },
    { id: 377, name: "Wincham Park", postcode: "", latitude: 53.26030, longitude: -2.51450, is_approximate: 1 },
    { id: 378, name: "Ericstan Stadium", postcode: "", latitude: 53.38040, longitude: -2.26320, is_approximate: 1 },
    { id: 379, name: "Len Salmon Stadium", postcode: "", latitude: 51.56020, longitude: 0.50800, is_approximate: 1 },
    { id: 380, name: "Brantham Leisure Centre", postcode: "", latitude: 51.96700, longitude: 1.06820, is_approximate: 1 },
    { id: 381, name: "North Road", postcode: "", latitude: 51.81960, longitude: 1.01430, is_approximate: 1 },
    { id: 382, name: "West Way", postcode: "", latitude: 52.19760, longitude: 0.13920, is_approximate: 1 },
    { id: 383, name: "Thames Road", postcode: "", latitude: 51.52420, longitude: 0.60850, is_approximate: 1 },
    { id: 384, name: "Memorial Field", postcode: "", latitude: 52.60260, longitude: 0.37730, is_approximate: 1 },
    { id: 385, name: "Dellwood Avenue", postcode: "", latitude: 51.96430, longitude: 1.32900, is_approximate: 1 },
    { id: 386, name: "Wellesley Recreation Ground", postcode: "", latitude: 52.60720, longitude: 1.73150, is_approximate: 1 },
    { id: 387, name: "Chadfields", postcode: "", latitude: 51.47810, longitude: 0.32330, is_approximate: 1 },
    { id: 388, name: "Scraley Road", postcode: "", latitude: 51.73270, longitude: 0.77520, is_approximate: 1 },
    { id: 389, name: "Crown Meadow", postcode: "", latitude: 52.47660, longitude: 1.75380, is_approximate: 1 },
    { id: 390, name: "Wallace Binder Ground", postcode: "", latitude: 51.71560, longitude: 0.68440, is_approximate: 1 },
    { id: 391, name: "Recreation Way", postcode: "", latitude: 52.34560, longitude: 0.51280, is_approximate: 1 },
    { id: 392, name: "Cricket Field Road", postcode: "", latitude: 52.24430, longitude: 0.40660, is_approximate: 1 },
    { id: 393, name: "Oakside Stadium", postcode: "", latitude: 51.57700, longitude: 0.09490, is_approximate: 1 },
    { id: 394, name: "Hawthorns", postcode: "", latitude: 51.88270, longitude: 0.81350, is_approximate: 1 },
    { id: 395, name: "Station Road", postcode: "", latitude: 51.88190, longitude: 0.27190, is_approximate: 1 },
    { id: 397, name: "Capershotts", postcode: "", latitude: 51.68050, longitude: 0.03310, is_approximate: 1 },
    { id: 398, name: "Wadham Lodge", postcode: "", latitude: 51.58450, longitude: -0.01880, is_approximate: 1 },
    { id: 399, name: "Spa Road", postcode: "", latitude: 51.80010, longitude: 0.63980, is_approximate: 1 },
    { id: 400, name: "Trafford Park", postcode: "", latitude: 52.70650, longitude: 1.40360, is_approximate: 1 },
    { id: 401, name: "Onsite Group Stadium", postcode: "", latitude: 50.84890, longitude: -1.12500, is_approximate: 1 },
    { id: 402, name: "The Racecourse Ground", postcode: "", latitude: 51.41500, longitude: -0.66280, is_approximate: 0 },
    { id: 403, name: "Bedfont Recreation Ground", postcode: "", latitude: 51.45310, longitude: -0.43090, is_approximate: 1 },
    { id: 404, name: "Hill Farm Lane", postcode: "", latitude: 51.40940, longitude: -0.79060, is_approximate: 1 },
    { id: 405, name: "Nyewood Lane", postcode: "", latitude: 50.78700, longitude: -0.69020, is_approximate: 0 },
    { id: 406, name: "Runnymede Stadium", postcode: "", latitude: 51.43130, longitude: -0.54730, is_approximate: 1 },
    { id: 407, name: "Cams Alders Football Stadium", postcode: "", latitude: 50.85270, longitude: -1.17830, is_approximate: 1 },
    { id: 408, name: "Rectory Meadow", postcode: "", latitude: 51.43310, longitude: -0.39670, is_approximate: 0 },
    { id: 409, name: "Earlsmead Stadium", postcode: "", latitude: 51.59680, longitude: -0.33730, is_approximate: 1 },
    { id: 410, name: "The Memorial Playing Fields", postcode: "", latitude: 51.30110, longitude: -0.90640, is_approximate: 0 },
    { id: 411, name: "SkyEx Community Stadium", postcode: "", latitude: 51.53000, longitude: -0.42600, is_approximate: 1 },
    { id: 412, name: "Silver Jubilee Park", postcode: "", latitude: 51.57670, longitude: -0.25420, is_approximate: 0 },
    { id: 413, name: "Five Heads Park", postcode: "", latitude: 50.92250, longitude: -1.00220, is_approximate: 1 },
    { id: 414, name: "Imperial Fields", postcode: "", latitude: 51.40280, longitude: -0.19480, is_approximate: 1 },
    { id: 415, name: "Fetcham Grove", postcode: "", latitude: 51.29550, longitude: -0.32930, is_approximate: 1 },
    { id: 416, name: "The Sportsfield", postcode: "", latitude: 50.80960, longitude: -0.54240, is_approximate: 1 },
    { id: 417, name: "Imber Court", postcode: "", latitude: 51.39030, longitude: -0.35170, is_approximate: 0 },
    { id: 418, name: "John Jenkins Stadium", postcode: "", latitude: 50.80000, longitude: -1.09060, is_approximate: 1 },
    { id: 419, name: "Grand Drive", postcode: "", latitude: 51.40330, longitude: -0.22690, is_approximate: 0 },
    { id: 420, name: "King George's Field", postcode: "", latitude: 51.23770, longitude: -0.20570, is_approximate: 1 },
    { id: 422, name: "Woking Park", postcode: "", latitude: 51.32020, longitude: -0.55650, is_approximate: 1 },
    { id: 423, name: "Mayfield Stadium", postcode: "", latitude: 51.37130, longitude: -0.10200, is_approximate: 1 },
    { id: 424, name: "Church Road", postcode: "", latitude: 51.31010, longitude: -0.07950, is_approximate: 1 },
    { id: 425, name: "The Homelands", postcode: "", latitude: 51.14860, longitude: 0.87230, is_approximate: 1 },
    { id: 426, name: "Eden Park Avenue", postcode: "", latitude: 51.40710, longitude: -0.03030, is_approximate: 1 },
    { id: 427, name: "High Wood Hill Sports Ground", postcode: "", latitude: 51.07050, longitude: -0.36110, is_approximate: 1 },
    { id: 428, name: "Crowborough Community Stadium", postcode: "", latitude: 51.05900, longitude: 0.16360, is_approximate: 1 },
    { id: 429, name: "Charles Sports Ground", postcode: "", latitude: 51.22400, longitude: 1.40270, is_approximate: 1 },
    { id: 430, name: "East Court", postcode: "", latitude: 51.12860, longitude: -0.01430, is_approximate: 1 },
    { id: 431, name: "The Saffrons", postcode: "", latitude: 50.76640, longitude: 0.27820, is_approximate: 1 },
    { id: 432, name: "Bayliss Avenue", postcode: "", latitude: 51.48080, longitude: 0.17920, is_approximate: 1 },
    { id: 433, name: "Salters Lane", postcode: "", latitude: 51.31580, longitude: 0.89110, is_approximate: 1 },
    { id: 434, name: "The Beacon Ground", postcode: "", latitude: 50.92430, longitude: -0.14530, is_approximate: 1 },
    { id: 435, name: "The Pilot Field", postcode: "", latitude: 50.85510, longitude: 0.58220, is_approximate: 1 },
    { id: 436, name: "Winch's Field", postcode: "", latitude: 51.37200, longitude: 1.13070, is_approximate: 1 },
    { id: 437, name: "Springfield Stadium", postcode: "", latitude: 49.18570, longitude: -2.11020, is_approximate: 1 },
    { id: 438, name: "Hartsdown Park", postcode: "", latitude: 51.38780, longitude: 1.38200, is_approximate: 1 },
    { id: 439, name: "Moatside", postcode: "", latitude: 51.24790, longitude: -0.15820, is_approximate: 1 },
    { id: 440, name: "Greatness Park", postcode: "", latitude: 51.27450, longitude: 0.19610, is_approximate: 1 },
    { id: 441, name: "Holm Park", postcode: "", latitude: 51.44040, longitude: 0.77850, is_approximate: 1 },
    { id: 442, name: "Woodstock Park", postcode: "", latitude: 51.33970, longitude: 0.73420, is_approximate: 1 },
    { id: 443, name: "Jubilee Field", postcode: "", latitude: 51.11750, longitude: -0.16110, is_approximate: 1 },
    { id: 444, name: "Oakwood", postcode: "", latitude: 51.45160, longitude: 0.17870, is_approximate: 1 },
    { id: 445, name: "Creasey Park", postcode: "", latitude: 51.88610, longitude: -0.52090, is_approximate: 1 },
    { id: 446, name: "The Meadow", postcode: "", latitude: 51.70500, longitude: -0.61110, is_approximate: 1 },
    { id: 447, name: "Sharpenhoe Road", postcode: "", latitude: 51.96740, longitude: -0.42570, is_approximate: 1 },
    { id: 448, name: "Holloways Park", postcode: "", latitude: 51.60830, longitude: -0.65710, is_approximate: 1 },
    { id: 449, name: "The Eyrie", postcode: "", latitude: 52.08820, longitude: -0.25890, is_approximate: 1 },
    { id: 450, name: "Langford Road", postcode: "", latitude: 52.08820, longitude: -0.25890, is_approximate: 1 },
    { id: 452, name: "Wilks Park", postcode: "", latitude: 51.60310, longitude: -0.72000, is_approximate: 1 },
    { id: 453, name: "Brickfield Lane", postcode: "", latitude: 51.65310, longitude: -0.20020, is_approximate: 1 },
    { id: 454, name: "Hertingfordbury Park", postcode: "", latitude: 51.79500, longitude: -0.08000, is_approximate: 1 },
    { id: 455, name: "Top Field", postcode: "", latitude: 51.94870, longitude: -0.27790, is_approximate: 1 },
    { id: 456, name: "Bell Close", postcode: "", latitude: 51.91660, longitude: -0.66210, is_approximate: 1 },
    { id: 457, name: "Pancake Lane", postcode: "", latitude: 51.75120, longitude: -0.47250, is_approximate: 1 },
    { id: 458, name: "Rowley Lane", postcode: "", latitude: 51.64320, longitude: -0.24230, is_approximate: 1 },
    { id: 459, name: "Alfred Davis Memorial Ground", postcode: "", latitude: 51.56700, longitude: -0.77300, is_approximate: 1 },
    { id: 460, name: "Manor Fields", postcode: "", latitude: 51.99440, longitude: -0.73260, is_approximate: 1 },
    { id: 461, name: "Northwood Park", postcode: "", latitude: 51.60520, longitude: -0.42060, is_approximate: 1 },
    { id: 462, name: "The Tithe Farm Social Club", postcode: "", latitude: 51.57670, longitude: -0.37030, is_approximate: 1 },
    { id: 463, name: "The JSJ Stadium", postcode: "", latitude: 52.01500, longitude: -0.22510, is_approximate: 1 },
    { id: 464, name: "Meadow View Park", postcode: "", latitude: 51.74830, longitude: -0.97820, is_approximate: 1 },
    { id: 465, name: "Wodson Park", postcode: "", latitude: 51.81100, longitude: -0.02800, is_approximate: 1 },
    { id: 466, name: "Herns Way", postcode: "", latitude: 51.80310, longitude: -0.20690, is_approximate: 1 },
    { id: 467, name: "Bashley Road", postcode: "", latitude: 50.75310, longitude: -1.65510, is_approximate: 1 },
    { id: 468, name: "The Sports Ground", postcode: "", latitude: 51.01810, longitude: -4.20640, is_approximate: 1 },
    { id: 469, name: "Kayte Lane", postcode: "", latitude: 51.94310, longitude: -2.07230, is_approximate: 1 },
    { id: 470, name: "The Creek", postcode: "", latitude: 51.45380, longitude: -2.59730, is_approximate: 1 },
    { id: 471, name: "Wall Park Road", postcode: "", latitude: 50.39520, longitude: -3.51450, is_approximate: 1 },
    { id: 472, name: "Loop Meadow", postcode: "", latitude: 51.60640, longitude: -1.24600, is_approximate: 1 },
    { id: 473, name: "Southern Road", postcode: "", latitude: 50.61910, longitude: -3.41470, is_approximate: 1 },
    { id: 474, name: "Bickland Park", postcode: "", latitude: 50.15530, longitude: -5.07230, is_approximate: 1 },
    { id: 475, name: "Badgers Hill", postcode: "", latitude: 51.22950, longitude: -2.31980, is_approximate: 1 },
    { id: 476, name: "Hartpury University Stadium", postcode: "", latitude: 51.91780, longitude: -2.30780, is_approximate: 1 },
    { id: 477, name: "The Plain Ham Ground", postcode: "", latitude: 51.38140, longitude: -2.35970, is_approximate: 1 },
    { id: 478, name: "Langland Stadium", postcode: "", latitude: 52.11600, longitude: -2.32590, is_approximate: 1 },
    { id: 479, name: "Oakfield Stadium", postcode: "", latitude: 51.37590, longitude: -2.13150, is_approximate: 1 },
    { id: 480, name: "Trungle Parc", postcode: "", latitude: 50.07800, longitude: -5.53900, is_approximate: 1 },
    { id: 481, name: "Bristol Road", postcode: "", latitude: 51.48100, longitude: -2.76900, is_approximate: 1 },
    { id: 482, name: "Cockrams", postcode: "", latitude: 51.01500, longitude: -2.19900, is_approximate: 1 },
    { id: 483, name: "Recreation Ground", postcode: "", latitude: 52.17100, longitude: -2.18700, is_approximate: 1 },
    { id: 484, name: "Hunts Copse Ground", postcode: "", latitude: 51.55800, longitude: -1.78200, is_approximate: 1 },
    { id: 485, name: "Langsford Park", postcode: "", latitude: 50.54800, longitude: -4.14500, is_approximate: 1 },
    { id: 486, name: "Meadow Lane", postcode: "", latitude: 51.25900, longitude: -2.19000, is_approximate: 1 },
    { id: 487, name: "The Stan Robinson Stadium", postcode: "", latitude: 50.88500, longitude: -3.37400, is_approximate: 1 },
    { id: 488, name: "The City Ground", postcode: "", latitude: 51.05200, longitude: -1.31200, is_approximate: 1 },
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
    { club_id: 1, sale_mode: "all_ticket", adult_price_pence: 3000, concession_price_pence: 2000, source_url: "https://www.chelseafc.com/en/tickets", verified_at: "2026-05-10", confidence: "imported" },
    { club_id: 2, sale_mode: "all_ticket", adult_price_pence: 2800, concession_price_pence: 1800, source_url: "https://www.arsenal.com/tickets", verified_at: "2026-05-10", confidence: "imported" },
    { club_id: 3, sale_mode: "all_ticket", adult_price_pence: 3100, concession_price_pence: 2100, source_url: "https://tickets.manutd.com/", verified_at: "2026-05-10", confidence: "imported" },
    { club_id: 4, sale_mode: "pay_on_gate", adult_price_pence: 2200, concession_price_pence: 1500, source_url: "https://www.eticketing.co.uk/qpr/", verified_at: "2026-05-10", confidence: "imported" },
    { club_id: 5, sale_mode: "all_ticket", adult_price_pence: 2500, concession_price_pence: 1700, source_url: "https://tickets.canaries.co.uk/", verified_at: "2026-05-10", confidence: "imported" },
    { club_id: 6, sale_mode: "pay_on_gate", adult_price_pence: 2000, concession_price_pence: 1200, source_url: "https://www.bcfc.com/tickets/", verified_at: "2026-05-10", confidence: "imported" }
  ],
  fixtures: [
    { source: "historical_seed", source_id: "pl-che-ars-2025-05-18", competition_code: "PL", home_club_id: 1, away_club_id: 2, venue_id: 1, kickoff_at: "2025-05-18T15:00:00.000Z", fixture_date: "2025-05-18", kickoff_time: "15:00", kickoff_time_status: "unknown", season_label: "2025-26", status: "finished", is_demo_data: 1, is_historical: 1, home_one_off: 0, away_one_off: 0, confidence: "imported" },
    { source: "historical_seed", source_id: "elc-qpr-nor-2025-05-03", competition_code: "ELC", home_club_id: 4, away_club_id: 5, venue_id: 2, kickoff_at: "2025-05-03T14:00:00.000Z", fixture_date: "2025-05-03", kickoff_time: "14:00", kickoff_time_status: "unknown", season_label: "2025-26", status: "finished", is_demo_data: 1, is_historical: 1, home_one_off: 0, away_one_off: 0, confidence: "imported" },
    { source: "historical_seed", source_id: "pl-mut-che-2025-05-25", competition_code: "PL", home_club_id: 3, away_club_id: 1, venue_id: 4, kickoff_at: "2025-05-25T15:00:00.000Z", fixture_date: "2025-05-25", kickoff_time: "15:00", kickoff_time_status: "unknown", season_label: "2025-26", status: "finished", is_demo_data: 1, is_historical: 1, home_one_off: 0, away_one_off: 0, confidence: "imported" },
    { source: "historical_seed", source_id: "elc-bir-qpr-2025-04-26", competition_code: "ELC", home_club_id: 6, away_club_id: 4, venue_id: 6, kickoff_at: "2025-04-26T14:00:00.000Z", fixture_date: "2025-04-26", kickoff_time: "14:00", kickoff_time_status: "unknown", season_label: "2025-26", status: "finished", is_demo_data: 1, is_historical: 1, home_one_off: 0, away_one_off: 0, confidence: "imported" }
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

  // Idempotent migration for existing D1 databases: add is_approximate if missing
  const colCheck = await db.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM pragma_table_info('venues') WHERE name = 'is_approximate'"
  );
  if (!colCheck || colCheck.count === 0) {
    await db.exec("ALTER TABLE venues ADD COLUMN is_approximate INTEGER NOT NULL DEFAULT 0 CHECK (is_approximate IN (0, 1))");
  }

  const pyramidIssues = validatePyramidSeason(MEN_PYRAMID_DIVISIONS, MEN_PYRAMID_SEASON_DIVISIONS, MEN_PYRAMID_MEMBERSHIPS, MEN_PYRAMID_MOVEMENTS);

  if (pyramidIssues.length > 0) {
    throw new Error(`Invalid pyramid seed data: ${pyramidIssues.map((issue) => issue.message).join("; ")}`);
  }

  const divisionDisplayOrder = computeDivisionDisplayOrder();
  const edgeAllocationType = computeEdgeAllocationType();
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
      [assignment.id, assignment.club_id, assignment.venue_id, assignment.effective_from, assignment.effective_to, assignment.is_primary]
    );
  }

  await binding.batch!(statements);
}
