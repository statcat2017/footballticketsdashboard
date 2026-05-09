export function normalizePostcode(postcode: string): string {
  const compact = postcode.replace(/\s+/g, "").toUpperCase();

  if (compact.length < 5 || compact.length > 7) {
    throw new Error("Enter a valid UK postcode.");
  }

  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function postcodeSeedCoordinate(postcode: string) {
  const normalized = normalizePostcode(postcode);
  const known: Record<string, { latitude: number; longitude: number }> = {
    "M16 0RA": { latitude: 53.4631, longitude: -2.2913 },
    "M11 3FF": { latitude: 53.4831, longitude: -2.2004 },
    "L4 0TH": { latitude: 53.4308, longitude: -2.9608 },
    "N5 1BU": { latitude: 51.5549, longitude: -0.1084 },
    "SW6 1HS": { latitude: 51.4817, longitude: -0.191 },
    "B6 6HE": { latitude: 52.5091, longitude: -1.8848 }
  };

  return known[normalized] ?? { latitude: 53.4808, longitude: -2.2426 };
}
