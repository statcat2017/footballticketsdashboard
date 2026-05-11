export interface Coordinate {
  latitude: number;
  longitude: number;
}

const POSTCODE_COORDINATES: Record<string, Coordinate> = {
  "N5 1BU": { latitude: 51.5549, longitude: -0.1084 },
  "B6 6HE": { latitude: 52.5092, longitude: -1.8848 },
  "BH7 7AF": { latitude: 50.7352, longitude: -1.8383 },
  "TW8 0RU": { latitude: 51.4908, longitude: -0.2887 },
  "BN1 9BL": { latitude: 50.8618, longitude: -0.0833 },
  "BB10 4BX": { latitude: 53.7891, longitude: -2.2302 },
  "SW6 1HS": { latitude: 51.4817, longitude: -0.191 },
  "SE25 6PU": { latitude: 51.3983, longitude: -0.0855 },
  "L5 9SR": { latitude: 53.4251, longitude: -3.0028 },
  "SW6 6HH": { latitude: 51.475, longitude: -0.2217 },
  "LS11 0ES": { latitude: 53.7778, longitude: -1.5721 },
  "L4 0TH": { latitude: 53.4308, longitude: -2.9608 },
  "M11 3FF": { latitude: 53.4831, longitude: -2.2004 },
  "M16 0RA": { latitude: 53.4631, longitude: -2.2913 },
  "NE1 4ST": { latitude: 54.9756, longitude: -1.6217 },
  "NG2 5FJ": { latitude: 52.9399, longitude: -1.1326 },
  "SR5 1SU": { latitude: 54.9144, longitude: -1.3882 },
  "N17 0BX": { latitude: 51.6043, longitude: -0.0662 },
  "E20 2ST": { latitude: 51.5386, longitude: -0.0165 },
  "WV1 4QR": { latitude: 52.5903, longitude: -2.1304 },
  "BB2 4JF": { latitude: 53.729141, longitude: -2.489562 },
  "NR1 1JE": { latitude: 52.6221, longitude: 1.3091 },
  "W12 7PJ": { latitude: 51.509694, longitude: -0.232085 },
  "ST4 4EG": { latitude: 52.988272, longitude: -2.176078 },
  "SA1 2FA": { latitude: 51.642161, longitude: -3.935137 },
  "B71 4LF": { latitude: 52.509018, longitude: -1.963293 },
  "HU3 6HU": { latitude: 53.745752, longitude: -0.368022 },
  "PO4 8RA": { latitude: 50.795912, longitude: -1.064868 },
  "B9 4RL": { latitude: 52.474936, longitude: -1.864108 },
  "LE2 7FL": { latitude: 52.620622, longitude: -1.143047 },
  "SO14 5FP": { latitude: 50.906521, longitude: -1.390814 },
  "DE24 8XL": { latitude: 52.914633, longitude: -1.447968 },
  "TS3 6RS": { latitude: 54.578137, longitude: -1.217779 },
  "S6 1SW": { latitude: 53.410844, longitude: -1.500859 },
  "WD18 0ER": { latitude: 51.649275, longitude: -0.400727 },
  "SE7 8BL": { latitude: 51.486242, longitude: 0.037178 },
  "IP1 2DA": { latitude: 52.054746, longitude: 1.144645 },
  "S2 4SU": { latitude: 53.369878, longitude: -1.470511 },
  "SE16 3LN": { latitude: 51.486672, longitude: -0.051027 },
  "BS3 2EJ": { latitude: 51.440711, longitude: -2.620604 },
  "LL11 2AH": { latitude: 53.051259, longitude: -3.003854 },
  "CV6 6GE": { latitude: 52.448773, longitude: -1.496283 },
  "PR1 6RU": { latitude: 53.772236, longitude: -2.689327 },
  "OX4 4XP": { latitude: 51.717071, longitude: -1.210938 }
};

const AREA_FALLBACK_COORDINATES = buildAreaFallbackCoordinates();

export interface ResolvedPostcodeOrigin {
  normalized: string;
  district: string;
  coordinate: Coordinate;
  source: "known" | "api" | "fallback";
}

export function normalizePostcode(postcode: string): string {
  const compact = postcode.replace(/\s+/g, "").toUpperCase();

  if (compact.length < 5 || compact.length > 7) {
    throw new Error("Enter a valid UK postcode.");
  }

  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function postcodeDistrict(postcode: string): string {
  return normalizePostcode(postcode).split(" ")[0];
}

export function postcodeCoordinate(postcode: string): Coordinate {
  const normalized = normalizePostcode(postcode);
  return POSTCODE_COORDINATES[normalized] ?? districtFallbackCoordinate(postcodeDistrict(normalized));
}

export async function resolvePostcodeOrigin(
  postcode: string,
  fetchImpl: typeof fetch = fetch
): Promise<ResolvedPostcodeOrigin> {
  const normalized = normalizePostcode(postcode);
  const district = postcodeDistrict(normalized);
  const known = POSTCODE_COORDINATES[normalized];

  if (known) {
    return {
      normalized,
      district,
      coordinate: known,
      source: "known"
    };
  }

  const apiCoordinate = await lookupPostcodeCoordinate(normalized, fetchImpl);

  if (apiCoordinate) {
    return {
      normalized,
      district,
      coordinate: apiCoordinate,
      source: "api"
    };
  }

  return {
    normalized,
    district,
    coordinate: districtFallbackCoordinate(district),
    source: "fallback"
  };
}

function districtFallbackCoordinate(district: string): Coordinate {
  const area = district.match(/^[A-Z]+/)?.[0];

  if (area && AREA_FALLBACK_COORDINATES[area]) {
    return AREA_FALLBACK_COORDINATES[area];
  }

  return { latitude: 51.5074, longitude: -0.1278 };
}

async function lookupPostcodeCoordinate(postcode: string, fetchImpl: typeof fetch): Promise<Coordinate | null> {
  const baseUrl = process.env.POSTCODES_IO_BASE_URL ?? "https://api.postcodes.io";
  const compact = postcode.replace(/\s+/g, "");

  try {
    const response = await fetchImpl(`${baseUrl}/postcodes/${compact}`);

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as {
      result?: {
        latitude?: number;
        longitude?: number;
      };
    };
    const latitude = payload.result?.latitude;
    const longitude = payload.result?.longitude;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return null;
    }

    return { latitude, longitude };
  } catch {
    return null;
  }
}

function buildAreaFallbackCoordinates(): Record<string, Coordinate> {
  const grouped = new Map<string, Array<Coordinate>>();

  for (const [postcode, coordinate] of Object.entries(POSTCODE_COORDINATES)) {
    const area = postcode.match(/^[A-Z]+/)?.[0];

    if (!area) {
      continue;
    }

    const existing = grouped.get(area) ?? [];
    existing.push(coordinate);
    grouped.set(area, existing);
  }

  return Object.fromEntries(Array.from(grouped.entries()).map(([area, coordinates]) => {
    const latitude = coordinates.reduce((sum, coordinate) => sum + coordinate.latitude, 0) / coordinates.length;
    const longitude = coordinates.reduce((sum, coordinate) => sum + coordinate.longitude, 0) / coordinates.length;

    return [area, { latitude, longitude }];
  }));
}
