export type PyramidStatus = "active" | "retired";
export type SeasonDivisionStatus = "open" | "locked";
export type ClubStatus = "known" | "partial" | "missing";
export type MovementType = "promotion" | "relegation";

export interface PyramidTemplateRow {
  id: number;
  code: string;
  name: string;
  sport: "mens";
  status: PyramidStatus;
}

export interface PyramidDivisionRow {
  id: number;
  template_id: number;
  code: string;
  name: string;
  level: number;
  max_size: number;
}

export interface PyramidEdgeRow {
  id: number;
  from_division_id: number;
  to_division_id: number;
  movement_type: MovementType;
  slots: number;
}

export interface PyramidSeasonRow {
  id: number;
  template_id: number;
  season_label: string;
}

export interface PyramidSeasonDivisionRow {
  id: number;
  season_id: number;
  template_id: number;
  division_id: number;
  status: SeasonDivisionStatus;
  locked_at: string | null;
}

export interface PyramidClubRow {
  id: number;
  name: string;
  aliases: string | null;
  league_name: string | null;
  ground_name: string | null;
  ground_address: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  source_url: string | null;
  verified_at: string | null;
  status: ClubStatus;
}

export interface PyramidMembershipRow {
  id: number;
  season_id: number;
  template_id: number;
  season_division_id: number;
  club_id: number;
}

export interface PyramidMovementRow {
  id: number;
  season_id: number;
  template_id: number;
  club_id: number;
  from_season_division_id: number;
  to_season_division_id: number;
  movement_type: MovementType;
  note: string | null;
  created_at: string;
}

export interface PyramidValidationIssue {
  code: "duplicate_club" | "division_over_capacity" | "invalid_movement" | "season_template_mismatch" | "unknown_season_division";
  message: string;
}

export const MEN_PYRAMID_TEMPLATE: PyramidTemplateRow = {
  id: 1,
  code: "mens",
  name: "Men's English Pyramid",
  sport: "mens",
  status: "active"
};

export const MEN_PYRAMID_DIVISIONS: PyramidDivisionRow[] = [
  { id: 1, template_id: 1, code: "premier-league", name: "Premier League", level: 1, max_size: 20 },
  { id: 2, template_id: 1, code: "championship", name: "Championship", level: 2, max_size: 24 },
  { id: 3, template_id: 1, code: "league-one", name: "League One", level: 3, max_size: 24 },
  { id: 4, template_id: 1, code: "league-two", name: "League Two", level: 4, max_size: 24 },
  { id: 5, template_id: 1, code: "national-league", name: "National League", level: 5, max_size: 24 },
  { id: 6, template_id: 1, code: "national-league-north", name: "National League North", level: 6, max_size: 24 },
  { id: 7, template_id: 1, code: "national-league-south", name: "National League South", level: 6, max_size: 24 },
  { id: 8, template_id: 1, code: "northern-premier-league-premier", name: "Northern Premier League Premier Division", level: 7, max_size: 22 },
  { id: 9, template_id: 1, code: "isthmian-league-premier", name: "Isthmian League Premier Division", level: 7, max_size: 22 },
  { id: 10, template_id: 1, code: "southern-league-premier-central", name: "Southern League Premier Central", level: 7, max_size: 22 },
  { id: 11, template_id: 1, code: "southern-league-premier-south", name: "Southern League Premier South", level: 7, max_size: 22 }
];

export const MEN_PYRAMID_EDGES: PyramidEdgeRow[] = [
  { id: 1, from_division_id: 1, to_division_id: 2, movement_type: "relegation", slots: 3 },
  { id: 2, from_division_id: 2, to_division_id: 1, movement_type: "promotion", slots: 2 },
  { id: 3, from_division_id: 2, to_division_id: 3, movement_type: "relegation", slots: 3 },
  { id: 4, from_division_id: 3, to_division_id: 2, movement_type: "promotion", slots: 3 },
  { id: 5, from_division_id: 3, to_division_id: 4, movement_type: "relegation", slots: 4 },
  { id: 6, from_division_id: 4, to_division_id: 3, movement_type: "promotion", slots: 4 },
  { id: 7, from_division_id: 4, to_division_id: 5, movement_type: "relegation", slots: 2 },
  { id: 8, from_division_id: 5, to_division_id: 4, movement_type: "promotion", slots: 4 },
  { id: 9, from_division_id: 5, to_division_id: 6, movement_type: "relegation", slots: 4 },
  { id: 10, from_division_id: 5, to_division_id: 7, movement_type: "relegation", slots: 4 },
  { id: 11, from_division_id: 6, to_division_id: 5, movement_type: "promotion", slots: 1 },
  { id: 12, from_division_id: 7, to_division_id: 5, movement_type: "promotion", slots: 1 },
  { id: 13, from_division_id: 6, to_division_id: 8, movement_type: "relegation", slots: 4 },
  { id: 14, from_division_id: 6, to_division_id: 10, movement_type: "relegation", slots: 4 },
  { id: 15, from_division_id: 7, to_division_id: 9, movement_type: "relegation", slots: 4 },
  { id: 16, from_division_id: 7, to_division_id: 11, movement_type: "relegation", slots: 4 },
  { id: 17, from_division_id: 8, to_division_id: 6, movement_type: "promotion", slots: 1 },
  { id: 18, from_division_id: 9, to_division_id: 7, movement_type: "promotion", slots: 1 },
  { id: 19, from_division_id: 10, to_division_id: 6, movement_type: "promotion", slots: 1 },
  { id: 20, from_division_id: 11, to_division_id: 7, movement_type: "promotion", slots: 1 }
];

export const MEN_PYRAMID_SEASONS: PyramidSeasonRow[] = [
  { id: 1, template_id: 1, season_label: "2025-26" }
];

export const MEN_PYRAMID_SEASON_DIVISIONS: PyramidSeasonDivisionRow[] = MEN_PYRAMID_DIVISIONS.map((division, index) => ({
  id: index + 1,
  season_id: 1,
  template_id: 1,
  division_id: division.id,
  status: "open",
  locked_at: null
}));

export const MEN_PYRAMID_CLUBS: PyramidClubRow[] = [
  // ── Premier League (season_division_id: 1) ──────────────────────
  { id: 1, name: "Arsenal", aliases: null, league_name: null, ground_name: "Emirates Stadium", ground_address: null, postcode: "N5 1BU", latitude: 51.555, longitude: -0.108, source_url: "https://www.arsenal.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 2, name: "Aston Villa", aliases: null, league_name: null, ground_name: "Villa Park", ground_address: null, postcode: "B6 6HE", latitude: 52.509, longitude: -1.885, source_url: "https://www.avfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 3, name: "Bournemouth", aliases: null, league_name: null, ground_name: "Dean Court", ground_address: null, postcode: "BH7 7AF", latitude: 50.735, longitude: -1.838, source_url: "https://www.afcb.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 4, name: "Brentford", aliases: null, league_name: null, ground_name: "Brentford Community Stadium", ground_address: null, postcode: "TW8 0RU", latitude: 51.491, longitude: -0.289, source_url: "https://tickets.brentfordfc.com", verified_at: "2026-05-15", status: "known" },
  { id: 5, name: "Brighton & Hove Albion", aliases: null, league_name: null, ground_name: "Falmer Stadium", ground_address: null, postcode: "BN1 9BL", latitude: 50.862, longitude: -0.083, source_url: "https://tickets.brightonandhovealbion.com", verified_at: "2026-05-15", status: "known" },
  { id: 6, name: "Burnley", aliases: null, league_name: null, ground_name: "Turf Moor", ground_address: null, postcode: "BB10 4BX", latitude: 53.789, longitude: -2.23, source_url: "https://www.burnleyfc.com/en/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 7, name: "Chelsea", aliases: null, league_name: null, ground_name: "Stamford Bridge", ground_address: null, postcode: "SW6 1HS", latitude: 51.482, longitude: -0.191, source_url: "https://www.chelseafc.com/en/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 8, name: "Crystal Palace", aliases: null, league_name: null, ground_name: "Selhurst Park", ground_address: null, postcode: "SE25 6PU", latitude: 51.398, longitude: -0.086, source_url: "https://www.cpfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 9, name: "Everton", aliases: null, league_name: null, ground_name: "Hill Dickinson Stadium", ground_address: null, postcode: "L4 0TH", latitude: 53.425, longitude: -3.003, source_url: "https://www.evertonfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 10, name: "Fulham", aliases: null, league_name: null, ground_name: "Craven Cottage", ground_address: null, postcode: "SW6 6HH", latitude: 51.475, longitude: -0.222, source_url: "https://www.fulhamfc.com/en/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 11, name: "Leeds United", aliases: null, league_name: null, ground_name: "Elland Road", ground_address: null, postcode: "LS11 0ES", latitude: 53.778, longitude: -1.572, source_url: "https://www.leedsunited.com/en/tickets-and-hospitality", verified_at: "2026-05-15", status: "known" },
  { id: 12, name: "Liverpool", aliases: null, league_name: null, ground_name: "Anfield", ground_address: null, postcode: "L4 0TH", latitude: 53.431, longitude: -2.961, source_url: "https://www.liverpoolfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 13, name: "Manchester City", aliases: null, league_name: null, ground_name: "City of Manchester Stadium", ground_address: null, postcode: "M11 3FF", latitude: 53.483, longitude: -2.2, source_url: "https://www.mancity.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 14, name: "Manchester United", aliases: null, league_name: null, ground_name: "Old Trafford", ground_address: null, postcode: "M16 0RA", latitude: 53.463, longitude: -2.291, source_url: "https://tickets.manutd.com", verified_at: "2026-05-15", status: "known" },
  { id: 15, name: "Newcastle United", aliases: null, league_name: null, ground_name: "St James' Park", ground_address: null, postcode: "NE1 4ST", latitude: 54.975, longitude: -1.622, source_url: "https://www.newcastleunited.com/en/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 16, name: "Nottingham Forest", aliases: null, league_name: null, ground_name: "City Ground", ground_address: null, postcode: "NG2 5FJ", latitude: 52.94, longitude: -1.133, source_url: "https://www.nottinghamforest.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 17, name: "Sunderland", aliases: null, league_name: null, ground_name: "Stadium of Light", ground_address: null, postcode: "SR5 1SU", latitude: 54.914, longitude: -1.388, source_url: "https://www.safc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 18, name: "Tottenham Hotspur", aliases: null, league_name: null, ground_name: "Tottenham Hotspur Stadium", ground_address: null, postcode: "N17 0AP", latitude: 51.603, longitude: -0.066, source_url: "https://www.tottenhamhotspur.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 19, name: "West Ham United", aliases: null, league_name: null, ground_name: "London Stadium", ground_address: null, postcode: "E20 2ST", latitude: 51.538, longitude: -0.017, source_url: "https://www.whufc.com/en/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 20, name: "Wolverhampton Wanderers", aliases: null, league_name: null, ground_name: "Molineux Stadium", ground_address: null, postcode: "WV1 4QR", latitude: 52.59, longitude: -2.13, source_url: "https://www.wolves.co.uk/tickets-hospitality", verified_at: "2026-05-15", status: "known" },
  // ── Championship (season_division_id: 2) ──────────────────────
  { id: 21, name: "Birmingham City", aliases: null, league_name: null, ground_name: "St Andrew's", ground_address: null, postcode: "B9 4RL", latitude: 52.476, longitude: -1.868, source_url: "https://www.bcfc.com/tickets/", verified_at: "2026-05-15", status: "known" },
  { id: 22, name: "Blackburn Rovers", aliases: null, league_name: null, ground_name: "Ewood Park", ground_address: null, postcode: "BB2 4JF", latitude: 53.728, longitude: -2.489, source_url: "https://www.rovers.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 23, name: "Bristol City", aliases: null, league_name: null, ground_name: "Ashton Gate", ground_address: null, postcode: "BS3 2EJ", latitude: 51.44, longitude: -2.62, source_url: "https://www.bcfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 24, name: "Charlton Athletic", aliases: null, league_name: null, ground_name: "The Valley", ground_address: null, postcode: "SE7 8BL", latitude: 51.487, longitude: 0.037, source_url: "https://www.charltonafc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 25, name: "Coventry City", aliases: null, league_name: null, ground_name: "Coventry Building Society Arena", ground_address: null, postcode: "CV6 6GE", latitude: 52.448, longitude: -1.496, source_url: "https://www.ccfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 26, name: "Derby County", aliases: null, league_name: null, ground_name: "Pride Park", ground_address: null, postcode: "DE24 8XL", latitude: 52.915, longitude: -1.447, source_url: "https://www.dcfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 27, name: "Hull City", aliases: null, league_name: null, ground_name: "MKM Stadium", ground_address: null, postcode: "HU3 6HU", latitude: 53.746, longitude: -0.368, source_url: "https://www.wearehullcity.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 28, name: "Ipswich Town", aliases: null, league_name: null, ground_name: "Portman Road", ground_address: null, postcode: "IP1 2DA", latitude: 52.055, longitude: 1.145, source_url: "https://www.itfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 29, name: "Leicester City", aliases: null, league_name: null, ground_name: "King Power Stadium", ground_address: null, postcode: "LE2 7FL", latitude: 52.62, longitude: -1.142, source_url: "https://www.lcfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 30, name: "Middlesbrough", aliases: null, league_name: null, ground_name: "Riverside Stadium", ground_address: null, postcode: "TS3 6RS", latitude: 54.578, longitude: -1.218, source_url: "https://www.mfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 31, name: "Millwall", aliases: null, league_name: null, ground_name: "The Den", ground_address: null, postcode: "SE16 3LN", latitude: 51.486, longitude: -0.05, source_url: "https://www.millwallfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 32, name: "Norwich City", aliases: null, league_name: null, ground_name: "Carrow Road", ground_address: null, postcode: "NR1 1JE", latitude: 52.622, longitude: 1.309, source_url: "https://www.canaries.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 33, name: "Oxford United", aliases: null, league_name: null, ground_name: "Kassam Stadium", ground_address: null, postcode: "OX4 4XP", latitude: 51.716, longitude: -1.208, source_url: "https://www.oufc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 34, name: "Portsmouth", aliases: null, league_name: null, ground_name: "Fratton Park", ground_address: null, postcode: "PO4 8RA", latitude: 50.796, longitude: -1.064, source_url: "https://www.portsmouthfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 35, name: "Preston North End", aliases: null, league_name: null, ground_name: "Deepdale", ground_address: null, postcode: "PR1 6RU", latitude: 53.772, longitude: -2.688, source_url: "https://www.pnefc.net/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 36, name: "Queens Park Rangers", aliases: null, league_name: null, ground_name: "Loftus Road", ground_address: null, postcode: "W12 7PJ", latitude: 51.509, longitude: -0.232, source_url: "https://www.eticketing.co.uk/qpr/", verified_at: "2026-05-15", status: "known" },
  { id: 37, name: "Sheffield United", aliases: null, league_name: null, ground_name: "Bramall Lane", ground_address: null, postcode: "S2 4SU", latitude: 53.369, longitude: -1.471, source_url: "https://www.sufc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 38, name: "Sheffield Wednesday", aliases: null, league_name: null, ground_name: "Hillsborough Stadium", ground_address: null, postcode: "S6 1SW", latitude: 53.412, longitude: -1.501, source_url: "https://www.swfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 39, name: "Southampton", aliases: null, league_name: null, ground_name: "St Mary's Stadium", ground_address: null, postcode: "SO14 5FP", latitude: 50.906, longitude: -1.391, source_url: "https://www.southamptonfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 40, name: "Stoke City", aliases: null, league_name: null, ground_name: "bet365 Stadium", ground_address: null, postcode: "ST4 4EG", latitude: 52.988, longitude: -2.175, source_url: "https://www.stokecityfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 41, name: "Swansea City", aliases: null, league_name: null, ground_name: "Swansea.com Stadium", ground_address: null, postcode: "SA1 2FA", latitude: 51.642, longitude: -3.935, source_url: "https://www.swanseacity.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 42, name: "Watford", aliases: null, league_name: null, ground_name: "Vicarage Road", ground_address: null, postcode: "WD18 0ER", latitude: 51.65, longitude: -0.402, source_url: "https://www.watfordfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 43, name: "West Bromwich Albion", aliases: null, league_name: null, ground_name: "The Hawthorns", ground_address: null, postcode: "B71 4LF", latitude: 52.509, longitude: -1.964, source_url: "https://www.wba.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 44, name: "Wrexham", aliases: null, league_name: null, ground_name: "Racecourse Ground", ground_address: null, postcode: "LL11 2AH", latitude: 53.052, longitude: -3.005, source_url: "https://www.wrexhamafc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  // ── League One (season_division_id: 3) ──────────────────────
  { id: 45, name: "AFC Wimbledon", aliases: null, league_name: null, ground_name: "Plough Lane", ground_address: null, postcode: "SW19 4RG", latitude: 51.425, longitude: -0.179, source_url: "https://www.afcwimbledon.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 46, name: "Barnsley", aliases: null, league_name: null, ground_name: "Oakwell", ground_address: null, postcode: "S71 1ET", latitude: 53.552, longitude: -1.467, source_url: "https://www.barnsleyfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 47, name: "Blackpool", aliases: null, league_name: null, ground_name: "Bloomfield Road", ground_address: null, postcode: "FY1 6JJ", latitude: 53.805, longitude: -3.048, source_url: "https://www.blackpoolfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 48, name: "Bolton Wanderers", aliases: null, league_name: null, ground_name: "Toughsheet Community Stadium", ground_address: null, postcode: "BL6 6JW", latitude: 53.58, longitude: -2.536, source_url: "https://www.bwfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 49, name: "Bradford City", aliases: null, league_name: null, ground_name: "Valley Parade", ground_address: null, postcode: "BD8 7DY", latitude: 53.804, longitude: -1.759, source_url: "https://www.bradfordcityfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 50, name: "Burton Albion", aliases: null, league_name: null, ground_name: "Pirelli Stadium", ground_address: null, postcode: "DE13 0BH", latitude: 52.822, longitude: -1.627, source_url: "https://www.burtonalbionfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 51, name: "Cardiff City", aliases: null, league_name: null, ground_name: "Cardiff City Stadium", ground_address: null, postcode: "CF11 8AZ", latitude: 51.473, longitude: -3.203, source_url: "https://www.cardiffcityfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 52, name: "Doncaster Rovers", aliases: null, league_name: null, ground_name: "Eco-Power Stadium", ground_address: null, postcode: "DN4 5JW", latitude: 53.51, longitude: -1.114, source_url: "https://www.doncasterroversfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 53, name: "Exeter City", aliases: null, league_name: null, ground_name: "St. James Park", ground_address: null, postcode: "EX4 6PX", latitude: 50.73, longitude: -3.521, source_url: "https://www.exetercityfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 54, name: "Huddersfield Town", aliases: null, league_name: null, ground_name: "Kirklees Stadium", ground_address: null, postcode: "HD1 6PX", latitude: 53.655, longitude: -1.768, source_url: "https://www.htafc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 55, name: "Leyton Orient", aliases: null, league_name: null, ground_name: "Brisbane Road", ground_address: null, postcode: "E10 5NF", latitude: 51.56, longitude: -0.013, source_url: "https://www.leytonorient.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 56, name: "Lincoln City", aliases: null, league_name: null, ground_name: "Sincil Bank", ground_address: null, postcode: "LN5 8LD", latitude: 53.22, longitude: -0.54, source_url: "https://www.weareimps.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 57, name: "Luton Town", aliases: null, league_name: null, ground_name: "Kenilworth Road", ground_address: null, postcode: "LU1 1DH", latitude: 51.884, longitude: -0.428, source_url: "https://www.lutontown.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 58, name: "Mansfield Town", aliases: null, league_name: null, ground_name: "Field Mill", ground_address: null, postcode: "NG18 5DA", latitude: 53.138, longitude: -1.201, source_url: "https://www.mansfieldtown.net/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 59, name: "Northampton Town", aliases: null, league_name: null, ground_name: "Sixfields Stadium", ground_address: null, postcode: "NN5 5QA", latitude: 52.235, longitude: -0.932, source_url: "https://www.ntfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 60, name: "Peterborough United", aliases: null, league_name: null, ground_name: "London Road Stadium", ground_address: null, postcode: "PE2 8AL", latitude: 52.565, longitude: -0.24, source_url: "https://www.theposh.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 61, name: "Plymouth Argyle", aliases: null, league_name: null, ground_name: "Home Park", ground_address: null, postcode: "PL2 3DQ", latitude: 50.388, longitude: -4.151, source_url: "https://www.pafc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 62, name: "Port Vale", aliases: null, league_name: null, ground_name: "Vale Park", ground_address: null, postcode: "ST6 1AW", latitude: 53.049, longitude: -2.189, source_url: "https://www.port-vale.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 63, name: "Reading", aliases: null, league_name: null, ground_name: "Madejski Stadium", ground_address: null, postcode: "RG2 0FL", latitude: 51.422, longitude: -0.983, source_url: "https://www.readingfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 64, name: "Rotherham United", aliases: null, league_name: null, ground_name: "New York Stadium", ground_address: null, postcode: "S60 1AH", latitude: 53.428, longitude: -1.362, source_url: "https://www.themillers.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 65, name: "Stevenage", aliases: null, league_name: null, ground_name: "Broadhall Way", ground_address: null, postcode: "SG2 8RH", latitude: 51.886, longitude: -0.19, source_url: "https://www.stevenagefc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 66, name: "Stockport County", aliases: null, league_name: null, ground_name: "Edgeley Park", ground_address: null, postcode: "SK3 9DD", latitude: 53.4, longitude: -2.167, source_url: "https://www.stockportcounty.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 67, name: "Wigan Athletic", aliases: null, league_name: null, ground_name: "Brick Community Stadium", ground_address: null, postcode: "WN5 0UZ", latitude: 53.548, longitude: -2.654, source_url: "https://wiganathletic.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 68, name: "Wycombe Wanderers", aliases: null, league_name: null, ground_name: "Adams Park", ground_address: null, postcode: "HP12 4HJ", latitude: 51.63, longitude: -0.8, source_url: "https://www.wwfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  // ── League Two (season_division_id: 4) ──────────────────────
  { id: 69, name: "Accrington Stanley", aliases: null, league_name: null, ground_name: "Crown Ground", ground_address: null, postcode: "BB5 5BX", latitude: 53.765, longitude: -2.37, source_url: "https://www.accringtonstanley.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 70, name: "Barnet", aliases: null, league_name: null, ground_name: "The Hive Stadium", ground_address: null, postcode: "HA8 5AU", latitude: 51.603, longitude: -0.292, source_url: "https://www.barnetfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 71, name: "Barrow", aliases: null, league_name: null, ground_name: "Holker Street", ground_address: null, postcode: "LA13 9HJ", latitude: 54.12, longitude: -3.226, source_url: "https://www.barrowafc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 72, name: "Bristol Rovers", aliases: null, league_name: null, ground_name: "Memorial Stadium", ground_address: null, postcode: "BS7 0BF", latitude: 51.486, longitude: -2.583, source_url: "https://www.bristolrovers.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 73, name: "Bromley", aliases: null, league_name: null, ground_name: "Hayes Lane", ground_address: null, postcode: "BR2 9EH", latitude: 51.382, longitude: 0.018, source_url: "https://www.bromleyfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 74, name: "Cambridge United", aliases: null, league_name: null, ground_name: "Abbey Stadium", ground_address: null, postcode: "CB5 8LN", latitude: 52.212, longitude: 0.153, source_url: "https://www.cambridgeunited.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 75, name: "Cheltenham Town", aliases: null, league_name: null, ground_name: "Whaddon Road", ground_address: null, postcode: "GL52 5NA", latitude: 51.907, longitude: -2.058, source_url: "https://www.ctfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 76, name: "Chesterfield", aliases: null, league_name: null, ground_name: "SMH Group Stadium", ground_address: null, postcode: "S41 8NZ", latitude: 53.258, longitude: -1.438, source_url: "https://www.chesterfieldfc.net/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 77, name: "Colchester United", aliases: null, league_name: null, ground_name: "Colchester Community Stadium", ground_address: null, postcode: "CO4 5UP", latitude: 51.923, longitude: 0.897, source_url: "https://www.colchesterunited.net/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 78, name: "Crawley Town", aliases: null, league_name: null, ground_name: "Broadfield Stadium", ground_address: null, postcode: "RH11 9RX", latitude: 51.099, longitude: -0.195, source_url: "https://www.crawleytownfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 79, name: "Crewe Alexandra", aliases: null, league_name: null, ground_name: "Gresty Road", ground_address: null, postcode: "CW2 6EB", latitude: 53.088, longitude: -2.436, source_url: "https://www.crewealex.net/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 80, name: "Fleetwood Town", aliases: null, league_name: null, ground_name: "Highbury Stadium", ground_address: null, postcode: "FY7 6TX", latitude: 53.917, longitude: -3.021, source_url: "https://www.fleetwoodtownfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 81, name: "Gillingham", aliases: null, league_name: null, ground_name: "Priestfield Stadium", ground_address: null, postcode: "ME7 4DD", latitude: 51.378, longitude: 0.561, source_url: "https://www.gillinghamfootballclub.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 82, name: "Grimsby Town", aliases: null, league_name: null, ground_name: "Blundell Park", ground_address: null, postcode: "DN35 7PY", latitude: 53.57, longitude: -0.046, source_url: "https://www.grimsby-townfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 83, name: "Harrogate Town", aliases: null, league_name: null, ground_name: "Wetherby Road", ground_address: null, postcode: "HG3 1SA", latitude: 53.991, longitude: -1.537, source_url: "https://www.harrogatetownafc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 84, name: "Milton Keynes Dons", aliases: null, league_name: null, ground_name: "Stadium MK", ground_address: null, postcode: "MK1 1ST", latitude: 52.009, longitude: -0.733, source_url: "https://www.mkdons.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 85, name: "Newport County", aliases: null, league_name: null, ground_name: "Rodney Parade", ground_address: null, postcode: "NP19 0UU", latitude: 51.591, longitude: -2.994, source_url: "https://www.newport-county.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 86, name: "Notts County", aliases: null, league_name: null, ground_name: "Meadow Lane", ground_address: null, postcode: "NG2 3HJ", latitude: 52.932, longitude: -1.135, source_url: "https://www.nottscountyfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 87, name: "Oldham Athletic", aliases: null, league_name: null, ground_name: "Boundary Park", ground_address: null, postcode: "OL1 2PA", latitude: 53.556, longitude: -2.119, source_url: "https://www.oldhamathletic.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 88, name: "Salford City", aliases: null, league_name: null, ground_name: "Moor Lane", ground_address: null, postcode: "M7 3PZ", latitude: 53.5, longitude: -2.272, source_url: "https://www.salfordcityfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 89, name: "Shrewsbury Town", aliases: null, league_name: null, ground_name: "New Meadow", ground_address: null, postcode: "SY2 6AB", latitude: 52.68, longitude: -2.75, source_url: "https://www.shrewsburytown.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 90, name: "Swindon Town", aliases: null, league_name: null, ground_name: "County Ground", ground_address: null, postcode: "SN1 2ED", latitude: 51.564, longitude: -1.771, source_url: "https://www.swindontownfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 91, name: "Tranmere Rovers", aliases: null, league_name: null, ground_name: "Prenton Park", ground_address: null, postcode: "CH42 9QA", latitude: 53.373, longitude: -3.036, source_url: "https://www.tranmererovers.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 92, name: "Walsall", aliases: null, league_name: null, ground_name: "Bescot Stadium", ground_address: null, postcode: "WS1 4SA", latitude: 52.565, longitude: -1.991, source_url: "https://www.saddlers.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  // ── National League (season_division_id: 5) ──────────────────────
  { id: 93, name: "Aldershot Town", aliases: null, league_name: null, ground_name: "The Recreation Ground", ground_address: null, postcode: "GU11 2TU", latitude: 51.241, longitude: -0.77, source_url: "https://www.theshots.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 94, name: "Altrincham", aliases: null, league_name: null, ground_name: "Moss Lane", ground_address: null, postcode: "WA15 8AP", latitude: 53.383, longitude: -2.332, source_url: "https://www.altrinchamfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 95, name: "Boreham Wood", aliases: null, league_name: null, ground_name: "Meadow Park", ground_address: null, postcode: "WD6 1EA", latitude: 51.671, longitude: -0.274, source_url: "https://www.borehamwoodfootballclub.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 96, name: "Boston United", aliases: null, league_name: null, ground_name: "Boston Community Stadium", ground_address: null, postcode: "PE21 7JJ", latitude: 52.977, longitude: -0.032, source_url: "https://www.bostonunited.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 97, name: "Brackley Town", aliases: null, league_name: null, ground_name: "St. James Park", ground_address: null, postcode: "NN13 6EJ", latitude: 52.029, longitude: -1.14, source_url: "https://www.brackleytownfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 98, name: "Braintree Town", aliases: null, league_name: null, ground_name: "Cressing Road", ground_address: null, postcode: "CM7 3PS", latitude: 51.877, longitude: 0.548, source_url: "https://www.braintreetownfc.org.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 99, name: "Carlisle United", aliases: null, league_name: null, ground_name: "Brunton Park", ground_address: null, postcode: "CA1 7TJ", latitude: 54.895, longitude: -2.93, source_url: "https://www.carlisleunited.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 100, name: "Eastleigh", aliases: null, league_name: null, ground_name: "Ten Acres", ground_address: null, postcode: "SO50 9HT", latitude: 50.946, longitude: -1.346, source_url: "https://www.eastleighfc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 101, name: "FC Halifax Town", aliases: null, league_name: null, ground_name: "The Shay", ground_address: null, postcode: "HX1 2YS", latitude: 53.72, longitude: -1.867, source_url: "https://www.fchalifaxtown.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 102, name: "Forest Green Rovers", aliases: null, league_name: null, ground_name: "The New Lawn", ground_address: null, postcode: "GL6 0FG", latitude: 51.706, longitude: -2.242, source_url: "https://www.fgr.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 103, name: "Gateshead", aliases: null, league_name: null, ground_name: "Gateshead International Stadium", ground_address: null, postcode: "NE11 0EH", latitude: 54.961, longitude: -1.605, source_url: "https://www.gateshead-fc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 104, name: "Hartlepool United", aliases: null, league_name: null, ground_name: "Victoria Park", ground_address: null, postcode: "TS24 8BZ", latitude: 54.69, longitude: -1.22, source_url: "https://www.hartlepoolunited.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 105, name: "Morecambe", aliases: null, league_name: null, ground_name: "Mazuma Mobile Stadium", ground_address: null, postcode: "LA4 4TB", latitude: 54.065, longitude: -2.87, source_url: "https://www.morecambefc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 106, name: "Rochdale", aliases: null, league_name: null, ground_name: "Spotland Stadium", ground_address: null, postcode: "OL11 5DS", latitude: 53.619, longitude: -2.157, source_url: "https://www.rochdaleafc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 107, name: "Scunthorpe United", aliases: null, league_name: null, ground_name: "Glanford Park", ground_address: null, postcode: "DN15 8TD", latitude: 53.586, longitude: -0.693, source_url: "https://www.scunthorpe-united.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 108, name: "Solihull Moors", aliases: null, league_name: null, ground_name: "Damson Park", ground_address: null, postcode: "B92 9EJ", latitude: 52.418, longitude: -1.768, source_url: "https://www.solihullmoorsfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 109, name: "Southend United", aliases: null, league_name: null, ground_name: "Roots Hall", ground_address: null, postcode: "SS2 6NQ", latitude: 51.537, longitude: 0.724, source_url: "https://www.southendunited.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 110, name: "Sutton United", aliases: null, league_name: null, ground_name: "Gander Green Lane", ground_address: null, postcode: "SM1 2EY", latitude: 51.365, longitude: -0.191, source_url: "https://www.suttonunited.net/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 111, name: "Tamworth", aliases: null, league_name: null, ground_name: "The Lamb Ground", ground_address: null, postcode: "B77 4EW", latitude: 52.874, longitude: -1.654, source_url: "https://www.tamworthfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 112, name: "Truro City", aliases: null, league_name: null, ground_name: "Truro City Stadium", ground_address: null, postcode: "TR1 2JF", latitude: 50.267, longitude: -5.053, source_url: "https://www.trurocityfc.net/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 113, name: "Wealdstone", aliases: null, league_name: null, ground_name: "Grosvenor Vale", ground_address: null, postcode: "HA5 3PP", latitude: 51.591, longitude: -0.378, source_url: "https://www.wealdstone-fc.com/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 114, name: "Woking", aliases: null, league_name: null, ground_name: "Kingfield Stadium", ground_address: null, postcode: "GU22 9AA", latitude: 51.306, longitude: -0.563, source_url: "https://www.wokingfc.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 115, name: "Yeovil Town", aliases: null, league_name: null, ground_name: "Huish Park", ground_address: null, postcode: "BA22 8YF", latitude: 50.944, longitude: -2.652, source_url: "https://www.ytfc.net/tickets", verified_at: "2026-05-15", status: "known" },
  { id: 116, name: "York City", aliases: null, league_name: null, ground_name: "York Community Stadium", ground_address: null, postcode: "YO32 9LL", latitude: 53.985, longitude: -1.053, source_url: "https://www.yorkcityfootballclub.co.uk/tickets", verified_at: "2026-05-15", status: "known" },
];
export const MEN_PYRAMID_MEMBERSHIPS: PyramidMembershipRow[] = [
  // Premier League (season_division_id: 1)
  { id: 1, season_id: 1, template_id: 1, season_division_id: 1, club_id: 1 },
  { id: 2, season_id: 1, template_id: 1, season_division_id: 1, club_id: 2 },
  { id: 3, season_id: 1, template_id: 1, season_division_id: 1, club_id: 3 },
  { id: 4, season_id: 1, template_id: 1, season_division_id: 1, club_id: 4 },
  { id: 5, season_id: 1, template_id: 1, season_division_id: 1, club_id: 5 },
  { id: 6, season_id: 1, template_id: 1, season_division_id: 1, club_id: 6 },
  { id: 7, season_id: 1, template_id: 1, season_division_id: 1, club_id: 7 },
  { id: 8, season_id: 1, template_id: 1, season_division_id: 1, club_id: 8 },
  { id: 9, season_id: 1, template_id: 1, season_division_id: 1, club_id: 9 },
  { id: 10, season_id: 1, template_id: 1, season_division_id: 1, club_id: 10 },
  { id: 11, season_id: 1, template_id: 1, season_division_id: 1, club_id: 11 },
  { id: 12, season_id: 1, template_id: 1, season_division_id: 1, club_id: 12 },
  { id: 13, season_id: 1, template_id: 1, season_division_id: 1, club_id: 13 },
  { id: 14, season_id: 1, template_id: 1, season_division_id: 1, club_id: 14 },
  { id: 15, season_id: 1, template_id: 1, season_division_id: 1, club_id: 15 },
  { id: 16, season_id: 1, template_id: 1, season_division_id: 1, club_id: 16 },
  { id: 17, season_id: 1, template_id: 1, season_division_id: 1, club_id: 17 },
  { id: 18, season_id: 1, template_id: 1, season_division_id: 1, club_id: 18 },
  { id: 19, season_id: 1, template_id: 1, season_division_id: 1, club_id: 19 },
  { id: 20, season_id: 1, template_id: 1, season_division_id: 1, club_id: 20 },
  // Championship (season_division_id: 2)
  { id: 21, season_id: 1, template_id: 1, season_division_id: 2, club_id: 21 },
  { id: 22, season_id: 1, template_id: 1, season_division_id: 2, club_id: 22 },
  { id: 23, season_id: 1, template_id: 1, season_division_id: 2, club_id: 23 },
  { id: 24, season_id: 1, template_id: 1, season_division_id: 2, club_id: 24 },
  { id: 25, season_id: 1, template_id: 1, season_division_id: 2, club_id: 25 },
  { id: 26, season_id: 1, template_id: 1, season_division_id: 2, club_id: 26 },
  { id: 27, season_id: 1, template_id: 1, season_division_id: 2, club_id: 27 },
  { id: 28, season_id: 1, template_id: 1, season_division_id: 2, club_id: 28 },
  { id: 29, season_id: 1, template_id: 1, season_division_id: 2, club_id: 29 },
  { id: 30, season_id: 1, template_id: 1, season_division_id: 2, club_id: 30 },
  { id: 31, season_id: 1, template_id: 1, season_division_id: 2, club_id: 31 },
  { id: 32, season_id: 1, template_id: 1, season_division_id: 2, club_id: 32 },
  { id: 33, season_id: 1, template_id: 1, season_division_id: 2, club_id: 33 },
  { id: 34, season_id: 1, template_id: 1, season_division_id: 2, club_id: 34 },
  { id: 35, season_id: 1, template_id: 1, season_division_id: 2, club_id: 35 },
  { id: 36, season_id: 1, template_id: 1, season_division_id: 2, club_id: 36 },
  { id: 37, season_id: 1, template_id: 1, season_division_id: 2, club_id: 37 },
  { id: 38, season_id: 1, template_id: 1, season_division_id: 2, club_id: 38 },
  { id: 39, season_id: 1, template_id: 1, season_division_id: 2, club_id: 39 },
  { id: 40, season_id: 1, template_id: 1, season_division_id: 2, club_id: 40 },
  { id: 41, season_id: 1, template_id: 1, season_division_id: 2, club_id: 41 },
  { id: 42, season_id: 1, template_id: 1, season_division_id: 2, club_id: 42 },
  { id: 43, season_id: 1, template_id: 1, season_division_id: 2, club_id: 43 },
  { id: 44, season_id: 1, template_id: 1, season_division_id: 2, club_id: 44 },
  // League One (season_division_id: 3)
  { id: 45, season_id: 1, template_id: 1, season_division_id: 3, club_id: 45 },
  { id: 46, season_id: 1, template_id: 1, season_division_id: 3, club_id: 46 },
  { id: 47, season_id: 1, template_id: 1, season_division_id: 3, club_id: 47 },
  { id: 48, season_id: 1, template_id: 1, season_division_id: 3, club_id: 48 },
  { id: 49, season_id: 1, template_id: 1, season_division_id: 3, club_id: 49 },
  { id: 50, season_id: 1, template_id: 1, season_division_id: 3, club_id: 50 },
  { id: 51, season_id: 1, template_id: 1, season_division_id: 3, club_id: 51 },
  { id: 52, season_id: 1, template_id: 1, season_division_id: 3, club_id: 52 },
  { id: 53, season_id: 1, template_id: 1, season_division_id: 3, club_id: 53 },
  { id: 54, season_id: 1, template_id: 1, season_division_id: 3, club_id: 54 },
  { id: 55, season_id: 1, template_id: 1, season_division_id: 3, club_id: 55 },
  { id: 56, season_id: 1, template_id: 1, season_division_id: 3, club_id: 56 },
  { id: 57, season_id: 1, template_id: 1, season_division_id: 3, club_id: 57 },
  { id: 58, season_id: 1, template_id: 1, season_division_id: 3, club_id: 58 },
  { id: 59, season_id: 1, template_id: 1, season_division_id: 3, club_id: 59 },
  { id: 60, season_id: 1, template_id: 1, season_division_id: 3, club_id: 60 },
  { id: 61, season_id: 1, template_id: 1, season_division_id: 3, club_id: 61 },
  { id: 62, season_id: 1, template_id: 1, season_division_id: 3, club_id: 62 },
  { id: 63, season_id: 1, template_id: 1, season_division_id: 3, club_id: 63 },
  { id: 64, season_id: 1, template_id: 1, season_division_id: 3, club_id: 64 },
  { id: 65, season_id: 1, template_id: 1, season_division_id: 3, club_id: 65 },
  { id: 66, season_id: 1, template_id: 1, season_division_id: 3, club_id: 66 },
  { id: 67, season_id: 1, template_id: 1, season_division_id: 3, club_id: 67 },
  { id: 68, season_id: 1, template_id: 1, season_division_id: 3, club_id: 68 },
  // League Two (season_division_id: 4)
  { id: 69, season_id: 1, template_id: 1, season_division_id: 4, club_id: 69 },
  { id: 70, season_id: 1, template_id: 1, season_division_id: 4, club_id: 70 },
  { id: 71, season_id: 1, template_id: 1, season_division_id: 4, club_id: 71 },
  { id: 72, season_id: 1, template_id: 1, season_division_id: 4, club_id: 72 },
  { id: 73, season_id: 1, template_id: 1, season_division_id: 4, club_id: 73 },
  { id: 74, season_id: 1, template_id: 1, season_division_id: 4, club_id: 74 },
  { id: 75, season_id: 1, template_id: 1, season_division_id: 4, club_id: 75 },
  { id: 76, season_id: 1, template_id: 1, season_division_id: 4, club_id: 76 },
  { id: 77, season_id: 1, template_id: 1, season_division_id: 4, club_id: 77 },
  { id: 78, season_id: 1, template_id: 1, season_division_id: 4, club_id: 78 },
  { id: 79, season_id: 1, template_id: 1, season_division_id: 4, club_id: 79 },
  { id: 80, season_id: 1, template_id: 1, season_division_id: 4, club_id: 80 },
  { id: 81, season_id: 1, template_id: 1, season_division_id: 4, club_id: 81 },
  { id: 82, season_id: 1, template_id: 1, season_division_id: 4, club_id: 82 },
  { id: 83, season_id: 1, template_id: 1, season_division_id: 4, club_id: 83 },
  { id: 84, season_id: 1, template_id: 1, season_division_id: 4, club_id: 84 },
  { id: 85, season_id: 1, template_id: 1, season_division_id: 4, club_id: 85 },
  { id: 86, season_id: 1, template_id: 1, season_division_id: 4, club_id: 86 },
  { id: 87, season_id: 1, template_id: 1, season_division_id: 4, club_id: 87 },
  { id: 88, season_id: 1, template_id: 1, season_division_id: 4, club_id: 88 },
  { id: 89, season_id: 1, template_id: 1, season_division_id: 4, club_id: 89 },
  { id: 90, season_id: 1, template_id: 1, season_division_id: 4, club_id: 90 },
  { id: 91, season_id: 1, template_id: 1, season_division_id: 4, club_id: 91 },
  { id: 92, season_id: 1, template_id: 1, season_division_id: 4, club_id: 92 },
  // National League (season_division_id: 5)
  { id: 93, season_id: 1, template_id: 1, season_division_id: 5, club_id: 93 },
  { id: 94, season_id: 1, template_id: 1, season_division_id: 5, club_id: 94 },
  { id: 95, season_id: 1, template_id: 1, season_division_id: 5, club_id: 95 },
  { id: 96, season_id: 1, template_id: 1, season_division_id: 5, club_id: 96 },
  { id: 97, season_id: 1, template_id: 1, season_division_id: 5, club_id: 97 },
  { id: 98, season_id: 1, template_id: 1, season_division_id: 5, club_id: 98 },
  { id: 99, season_id: 1, template_id: 1, season_division_id: 5, club_id: 99 },
  { id: 100, season_id: 1, template_id: 1, season_division_id: 5, club_id: 100 },
  { id: 101, season_id: 1, template_id: 1, season_division_id: 5, club_id: 101 },
  { id: 102, season_id: 1, template_id: 1, season_division_id: 5, club_id: 102 },
  { id: 103, season_id: 1, template_id: 1, season_division_id: 5, club_id: 103 },
  { id: 104, season_id: 1, template_id: 1, season_division_id: 5, club_id: 104 },
  { id: 105, season_id: 1, template_id: 1, season_division_id: 5, club_id: 105 },
  { id: 106, season_id: 1, template_id: 1, season_division_id: 5, club_id: 106 },
  { id: 107, season_id: 1, template_id: 1, season_division_id: 5, club_id: 107 },
  { id: 108, season_id: 1, template_id: 1, season_division_id: 5, club_id: 108 },
  { id: 109, season_id: 1, template_id: 1, season_division_id: 5, club_id: 109 },
  { id: 110, season_id: 1, template_id: 1, season_division_id: 5, club_id: 110 },
  { id: 111, season_id: 1, template_id: 1, season_division_id: 5, club_id: 111 },
  { id: 112, season_id: 1, template_id: 1, season_division_id: 5, club_id: 112 },
  { id: 113, season_id: 1, template_id: 1, season_division_id: 5, club_id: 113 },
  { id: 114, season_id: 1, template_id: 1, season_division_id: 5, club_id: 114 },
  { id: 115, season_id: 1, template_id: 1, season_division_id: 5, club_id: 115 },
  { id: 116, season_id: 1, template_id: 1, season_division_id: 5, club_id: 116 },
];
export const MEN_PYRAMID_MOVEMENTS: PyramidMovementRow[] = [];

export function validatePyramidSeason(
  divisions: PyramidDivisionRow[],
  seasonDivisions: PyramidSeasonDivisionRow[],
  memberships: PyramidMembershipRow[],
  movements: PyramidMovementRow[] = [],
  edges: PyramidEdgeRow[] = MEN_PYRAMID_EDGES
): PyramidValidationIssue[] {
  const issues: PyramidValidationIssue[] = [];
  const divisionById = new Map(divisions.map((division) => [division.id, division]));
  const seasonDivisionById = new Map(seasonDivisions.map((division) => [division.id, division]));
  const seasonKeys = new Set(seasonDivisions.map((division) => `${division.season_id}:${division.template_id}`));

  if (seasonKeys.size > 1) {
    issues.push({
      code: "season_template_mismatch",
      message: "Season divisions from multiple seasons or templates were provided to a single validation run."
    });
  }

  for (const seasonDivision of seasonDivisions) {
    const division = divisionById.get(seasonDivision.division_id);

    if (!division) {
      issues.push({
        code: "season_template_mismatch",
        message: `Season division ${seasonDivision.id} points at an unknown template division.`
      });
      continue;
    }

    if (seasonDivision.template_id !== division.template_id) {
      issues.push({
        code: "season_template_mismatch",
        message: `Season division ${seasonDivision.id} template does not match its template division.`
      });
    }
  }

  const membershipsByClub = new Map<number, PyramidMembershipRow[]>();
  const membershipsBySeasonDivision = new Map<number, PyramidMembershipRow[]>();
  const clubCurrentDivision = new Map<number, number>();

  for (const membership of memberships) {
    const clubMemberships = membershipsByClub.get(membership.club_id) ?? [];
    clubMemberships.push(membership);
    membershipsByClub.set(membership.club_id, clubMemberships);

    const seasonDivision = seasonDivisionById.get(membership.season_division_id);

    if (!seasonDivision) {
      issues.push({
        code: "unknown_season_division",
        message: `Membership ${membership.id} references an unknown season division.`
      });
      continue;
    }

    if (membership.season_id !== seasonDivision.season_id || membership.template_id !== seasonDivision.template_id) {
      issues.push({
        code: "season_template_mismatch",
        message: `Membership ${membership.id} does not match its season division template or season.`
      });
      continue;
    }

    const divisionMemberships = membershipsBySeasonDivision.get(membership.season_division_id) ?? [];
    divisionMemberships.push(membership);
    membershipsBySeasonDivision.set(membership.season_division_id, divisionMemberships);

    if (!clubCurrentDivision.has(membership.club_id)) {
      clubCurrentDivision.set(membership.club_id, membership.season_division_id);
    }
  }

  for (const [clubId, clubMemberships] of membershipsByClub) {
    if (clubMemberships.length > 1) {
      issues.push({
        code: "duplicate_club",
        message: `Club ${clubId} appears in more than one division for the same season.`
      });
    }
  }

  for (const [seasonDivisionId, divisionMemberships] of membershipsBySeasonDivision) {
    const seasonDivision = seasonDivisionById.get(seasonDivisionId);

    if (!seasonDivision) {
      issues.push({
        code: "unknown_season_division",
        message: `Season division ${seasonDivisionId} is unknown.`
      });
      continue;
    }

    const division = divisionById.get(seasonDivision.division_id);

    if (!division || seasonDivision.template_id !== division.template_id) {
      continue;
    }

    if (divisionMemberships.length > division.max_size) {
      issues.push({
        code: "division_over_capacity",
        message: `${division.name} has ${divisionMemberships.length} clubs, above the maximum of ${division.max_size}.`
      });
    }
  }

  const edgeKeys = new Set(
    edges.map((edge) => `${edge.from_division_id}:${edge.to_division_id}:${edge.movement_type}`)
  );

  for (const movement of movements) {
    const fromDivision = seasonDivisionById.get(movement.from_season_division_id);
    const toDivision = seasonDivisionById.get(movement.to_season_division_id);

    if (!fromDivision || !toDivision) {
      issues.push({
        code: "invalid_movement",
        message: `Movement ${movement.id} references an unknown season division.`
      });
      continue;
    }

    if (
      movement.season_id !== fromDivision.season_id ||
      movement.season_id !== toDivision.season_id ||
      movement.template_id !== fromDivision.template_id ||
      movement.template_id !== toDivision.template_id ||
      fromDivision.template_id !== toDivision.template_id
    ) {
      issues.push({
        code: "season_template_mismatch",
        message: `Movement ${movement.id} does not stay within a single season template.`
      });
      continue;
    }

    const clubDivisionId = clubCurrentDivision.get(movement.club_id);

    if (clubDivisionId !== movement.from_season_division_id) {
      issues.push({
        code: "invalid_movement",
        message: `Movement ${movement.id} does not match the club's source division.`
      });
      continue;
    }

    const fromTemplateDivision = divisionById.get(fromDivision.division_id);
    const toTemplateDivision = divisionById.get(toDivision.division_id);

    if (!fromTemplateDivision || !toTemplateDivision) {
      issues.push({
        code: "invalid_movement",
        message: `Movement ${movement.id} references an unknown template division.`
      });
      continue;
    }

    if (!edgeKeys.has(`${fromTemplateDivision.id}:${toTemplateDivision.id}:${movement.movement_type}`)) {
      issues.push({
        code: "invalid_movement",
        message: `Movement ${movement.id} is not allowed between ${fromTemplateDivision.name} and ${toTemplateDivision.name}.`
      });
    }
  }

  return issues;
}
