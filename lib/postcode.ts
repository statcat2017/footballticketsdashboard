export interface Coordinate {
  latitude: number;
  longitude: number;
}

const POSTCODE_COORDINATES: Record<string, Coordinate> = {
  "SW6 1HS": { latitude: 51.4817, longitude: -0.191 },
  "W12 7PJ": { latitude: 51.509, longitude: -0.2321 },
  "N5 1BU": { latitude: 51.5549, longitude: -0.1084 },
  "M16 0RA": { latitude: 53.4631, longitude: -2.2913 },
  "L4 0TH": { latitude: 53.4308, longitude: -2.9608 },
  "NR1 1JE": { latitude: 52.6221, longitude: 1.3091 },
  "B9 4RL": { latitude: 52.4756, longitude: -1.8682 }
};

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

function districtFallbackCoordinate(district: string): Coordinate {
  if (district.startsWith("SW") || district.startsWith("W")) {
    return { latitude: 51.49, longitude: -0.2 };
  }

  if (district.startsWith("M")) {
    return { latitude: 53.4808, longitude: -2.2426 };
  }

  if (district.startsWith("L")) {
    return { latitude: 53.4084, longitude: -2.9916 };
  }

  return { latitude: 51.5074, longitude: -0.1278 };
}
