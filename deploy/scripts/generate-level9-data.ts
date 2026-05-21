// Run: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/generate-level9-data.ts
// This script prints TS blocks to copy into pyramid.ts and seed-data.ts

type ClubDef = { name: string };
type DivisionDef = { name: string; code: string; divId: number; seasonDivId: number; clubs: ClubDef[] };

const DIVISIONS: DivisionDef[] = [
  {
    name: "Combined Counties League Premier Division North",
    code: "CC_PN",
    divId: 23, seasonDivId: 23,
    clubs: [
      "Abingdon United", "Amersham Town", "Ardley United", "Ashford Town (Middlesex)",
      "British Airways", "Broadfields United", "Burnham", "Edgware & Kingsbury",
      "Harefield United", "Hilltop", "Holyport", "Kidlington", "Milton United",
      "North Greenford United", "North Leigh", "Reading City", "Virginia Water",
      "Wallingford & Crowmarsh", "Windsor & Eton", "Wokingham Town",
    ].map(n => ({ name: n })),
  },
  {
    name: "Combined Counties League Premier Division South",
    code: "CC_PS",
    divId: 24, seasonDivId: 24,
    clubs: [
      "Abbey Rangers", "Alton", "Badshot Lea", "Balham", "Camberley Town",
      "Chipstead", "Cobham", "Corinthian-Casuals", "Epsom & Ewell",
      "Eversley & California", "Fleet Town", "Guildford City", "Horley Town",
      "Knaphill", "Redhill", "Sheerwater", "Sutton Common Rovers",
      "Tadley Calleva", "Thatcham Town", "Tooting & Mitcham United",
    ].map(n => ({ name: n })),
  },
  {
    name: "Eastern Counties League Premier Division",
    code: "EC_PREM",
    divId: 25, seasonDivId: 25,
    clubs: [
      "Mulbarton Wanderers", "Haverhill Rovers", "Ely City", "Soham Town Rangers",
      "Fakenham Town", "Thetford Town", "Ipswich Wanderers", "Great Yarmouth Town",
      "Harleston Town", "Dereham Town", "Woodbridge Town", "Walsham-le-Willows",
      "Stowmarket Town", "Kirkley & Pakefield", "Heacham", "Cornard United",
      "Lakenheath", "Hadleigh United",
    ].map(n => ({ name: n })),
  },
  {
    name: "Essex Senior League",
    code: "ESL",
    divId: 26, seasonDivId: 26,
    clubs: [
      "Little Oakley", "Soul Tower Hamlets", "Great Wakering Rovers", "Buckhurst Hill",
      "Barking", "Ilford", "Saffron Walden Town", "Benfleet", "Halstead Town",
      "Hullbridge Sports", "Woodford Town", "Hackney Wick", "Harwich & Parkeston",
      "Romford", "Basildon United", "White Ensign", "Sporting Bengal United",
      "West Essex", "Frenford", "Athletic Newham",
    ].map(n => ({ name: n })),
  },
  {
    name: "Hellenic League Premier Division",
    code: "HEL_PREM",
    divId: 27, seasonDivId: 27,
    clubs: [
      "Slimbridge", "Roman Glass St George", "Droitwich Spa", "Cirencester Town",
      "Worcester Raiders", "Corsham Town", "Fairford Town", "Cinderford Town",
      "Hereford Pegasus", "Tuffley Rovers", "Longlevens", "Highworth Town",
      "Mangotsfield United", "Westfields", "Hallen", "Royal Wootton Bassett Town",
      "Thornbury Town", "Pershore Town", "Cribbs", "Lydney Town",
    ].map(n => ({ name: n })),
  },
  {
    name: "Midland League Premier Division",
    code: "MFL_PREM",
    divId: 28, seasonDivId: 28,
    clubs: [
      "Hanley Town", "Northwich Victoria", "Winsford United", "1874 Northwich",
      "AFC Wolverhampton City", "Dudley Town", "Brocton", "Abbey Hulton United",
      "Lye Town", "Coton Green", "Whitchurch Alport", "Stone Old Alleynians",
      "Romulus", "Stourport Swifts", "Tividale", "Uttoxeter Town",
      "Highgate United", "Studley",
    ].map(n => ({ name: n })),
  },
  {
    name: "Northern Counties East League Premier Division",
    code: "NCE_PREM",
    divId: 29, seasonDivId: 29,
    clubs: [
      "Albion Sports", "Barton Town", "Beverley Town", "Bottesford Town",
      "Campion", "Eccleshill United", "Frickley Athletic", "Golcar United",
      "Handsworth", "Horbury Town", "Knaresborough Town", "Liversedge",
      "Parkgate", "Penistone Church", "Pickering Town", "Rossington Main",
      "Sheffield", "Tadcaster Albion", "Thackley", "Wombwell Town",
    ].map(n => ({ name: n })),
  },
  {
    name: "Northern League Division One",
    code: "NL_D1",
    divId: 30, seasonDivId: 30,
    clubs: [
      "Birtley Town", "Boro Rangers", "Carlisle City", "Crook Town",
      "Easington Colliery", "Guisborough Town", "Horden CW", "Kendal Town",
      "Marske United", "Newcastle Benfield", "Newcastle Blue Star", "North Shields",
      "Northallerton Town", "Penrith", "Shildon", "Thornaby",
      "West Allotment Celtic", "West Auckland Town", "Whickham", "Whitley Bay",
    ].map(n => ({ name: n })),
  },
  {
    name: "Southern Counties East League Premier Division",
    code: "SCE_PREM",
    divId: 31, seasonDivId: 31,
    clubs: [
      "Bearsted", "Chislehurst Glebe", "Corinthian", "Erith & Belvedere",
      "Faversham Strike Force", "Fisher", "Hollands & Blair", "Holmesdale",
      "Hythe Town", "Kennington", "Larkfield & New Hythe Wanderers",
      "Phoenix Sports", "Punjab United", "Rusthall", "Snodland Town",
      "Stansfeld", "Sutton Athletic", "Tunbridge Wells", "Whitstable Town",
    ].map(n => ({ name: n })),
  },
  {
    name: "Spartan South Midlands League Premier Division",
    code: "SSM_PREM",
    divId: 32, seasonDivId: 32,
    clubs: [
      "AFC Welwyn", "Arlesey Town", "Aylesbury Vale Dynamos", "Baldock Town",
      "Biggleswade United", "Cockfosters", "Colney Heath", "Crawley Green",
      "Dunstable Town", "Haringey Borough", "Harlow Town", "Harpenden Town",
      "Kempston Rovers", "Kings Langley", "Potton United", "Risborough Rangers",
      "Sawbridgeworth Town", "Tring Athletic", "Winslow United", "Wormley Rovers",
    ].map(n => ({ name: n })),
  },
  {
    name: "Southern Combination League Premier Division",
    code: "SCO_PREM",
    divId: 33, seasonDivId: 33,
    clubs: [
      "Steyning Town", "Haywards Heath Town", "Guernsey", "Horsham YM",
      "Peacehaven & Telscombe", "Eastbourne United", "Pagham", "Newhaven",
      "Bexhill United", "Roffey", "Seaford Town", "Crawley Down Gatwick",
      "Wick", "Forest Row", "Midhurst & Easebourne", "Little Common",
      "Lingfield", "AFC Varndeanians", "Lancing", "Shoreham",
    ].map(n => ({ name: n })),
  },
  {
    name: "United Counties League Premier Division North",
    code: "UCL_PN",
    divId: 34, seasonDivId: 34,
    clubs: [
      "Boston Town", "Sherwood Colliery", "Grantham Town", "Belper United",
      "Newark Town", "AFC Mansfield", "Eastwood Community", "Hucknall Town",
      "Clay Cross Town", "Gresley Rovers", "Skegness Town", "Melton Town",
      "Ashby Ivanhoe", "Kimberley Miners Welfare", "Wisbech Town",
      "Deeping Rangers", "Blackstones", "Newark and Sherwood United",
      "Heanor Town", "Harrowby United",
    ].map(n => ({ name: n })),
  },
  {
    name: "United Counties League Premier Division South",
    code: "UCL_PS",
    divId: 35, seasonDivId: 35,
    clubs: [
      "Nuneaton Town", "Coventry United", "Atherstone Town", "March Town United",
      "Aylestone Park", "Lutterworth Town", "Histon", "Moulton",
      "Newport Pagnell Town", "Eynesbury Rovers", "Hinckley AFC",
      "Northampton ON Chenecks", "Leicester Nirvana", "Daventry Town",
      "Godmanchester Rovers", "Easington Sports", "Northampton Sileby Rangers",
      "Yaxley", "Bugbrooke St Michaels", "GNG Oadby Town",
    ].map(n => ({ name: n })),
  },
  {
    name: "Wessex League Premier Division",
    code: "WES_PREM",
    divId: 36, seasonDivId: 36,
    clubs: [
      "AFC Stoneham", "Andover New Street", "Baffins Milton Rovers",
      "Bemerton Heath Harlequins", "Bournemouth FC", "Brockenhurst",
      "Christchurch", "Cowes Sports", "Downton", "East Cowes Victoria Athletic",
      "Hamble Club", "Hamworthy Recreation", "Hythe & Dibden",
      "Laverstock & Ford", "Millbrook", "New Milton Town", "Petersfield Town",
      "Portland United", "Sherborne Town", "Wincanton Town",
    ].map(n => ({ name: n })),
  },
  {
    name: "Western League Premier Division",
    code: "WESL_PREM",
    divId: 37, seasonDivId: 37,
    clubs: [
      "AFC St Austell", "Barnstaple Town", "Bradford Town", "Bridgwater United",
      "Brislington", "Buckland Athletic", "Clevedon Town", "Helston Athletic",
      "Ivybridge Town", "Nailsea & Tickenham", "Newquay", "Oldland Abbotonians",
      "Paulton Rovers", "Saltash United", "Shepton Mallet", "Sidmouth Town",
      "St Blazey", "Street", "Torpoint Athletic", "Wellington",
    ].map(n => ({ name: n })),
  },
];

// Generate output
let clubId = 489;

console.log("// === CLUBS for MEN_PYRAMID_CLUBS ===\n");
for (const div of DIVISIONS) {
  console.log(`  // ── ${div.name} (season_division_id: ${div.seasonDivId}) ──`);
  for (const club of div.clubs) {
    console.log(`  { id: ${clubId}, name: "${club.name}", aliases: null, league_name: null, source_url: null, verified_at: "2026-05-15", status: "known" },`);
    clubId++;
  }
  console.log();
}

// Memberships
console.log("// === MEMBERSHIPS for MEN_PYRAMID_MEMBERSHIPS ===\n");
clubId = 489;
let memId = 489;
for (const div of DIVISIONS) {
  console.log(`  // ${div.name} (season_division_id: ${div.seasonDivId})`);
  for (let ci = 0; ci < div.clubs.length; ci++) {
    console.log(`  { id: ${memId}, season_id: 1, template_id: 1, season_division_id: ${div.seasonDivId}, club_id: ${clubId} },`);
    clubId++;
    memId++;
  }
  console.log();
}

// Venue assignments
console.log("// === VENUE ASSIGNMENTS for CLUB_VENUE_ASSIGNMENTS ===\n");
let assignId = 489;
clubId = 489;
for (const div of DIVISIONS) {
  console.log(`  // ${div.name}`);
  for (let ci = 0; ci < div.clubs.length; ci++) {
    console.log(`  { id: ${assignId}, club_id: ${clubId}, venue_id: ${clubId}, effective_from: "2025-08-01", effective_to: null, is_primary: 1 },`);
    clubId++;
    assignId++;
  }
  console.log();
}

// Venues for seed-data.ts
console.log("// === VENUES for SEED_DATA.venues ===\n");
clubId = 489;

// Regional approximate coordinates per division
const DIV_COORDS: Record<string, { lat: number; lng: number }> = {
  "CC_PN": { lat: 51.5, lng: -0.7 },   // Berks/Bucks area
  "CC_PS": { lat: 51.3, lng: -0.5 },   // Surrey area
  "EC_PREM": { lat: 52.4, lng: 1.1 },  // Norfolk/Suffolk
  "ESL": { lat: 51.6, lng: 0.2 },      // Essex/London
  "HEL_PREM": { lat: 51.8, lng: -2.2 }, // Gloucs/Worcs
  "MFL_PREM": { lat: 52.6, lng: -2.0 }, // Staffs/WMids
  "NCE_PREM": { lat: 53.5, lng: -1.4 }, // Yorks
  "NL_D1": { lat: 54.8, lng: -1.8 },   // North East
  "SCE_PREM": { lat: 51.2, lng: 0.5 },  // Kent
  "SSM_PREM": { lat: 51.9, lng: -0.4 }, // Beds/Herts
  "SCO_PREM": { lat: 50.9, lng: -0.2 }, // Sussex
  "UCL_PN": { lat: 52.9, lng: -0.6 },  // Lincs/Notts
  "UCL_PS": { lat: 52.4, lng: -0.9 },  // Northants/Leics
  "WES_PREM": { lat: 50.9, lng: -1.5 }, // Hants/Dorset
  "WESL_PREM": { lat: 51.1, lng: -3.0 }, // Somerset/Devon
};

for (const div of DIVISIONS) {
  const coord = DIV_COORDS[div.code] || { lat: 52.0, lng: -1.0 };
  const postcode = "";
  for (const club of div.clubs) {
    console.log(`  { id: ${clubId}, name: "${club.name} FC", postcode: "${postcode}", latitude: ${coord.lat}, longitude: ${coord.lng}, is_approximate: 1 },`);
    clubId++;
  }
  console.log();
}

// Competition codes
console.log("// === COMPETITION CODES for SEED_DATA.competitions ===\n");
for (const div of DIVISIONS) {
  console.log(`{ division_id: ${div.divId}, competition_code: "${div.code}" },`);
}
