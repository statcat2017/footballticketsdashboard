import type { Coordinate } from "@/lib/postcode";

const EARTH_RADIUS_MILES = 3958.8;

function radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function distanceMiles(from: Coordinate, to: Coordinate): number {
  if (
    !Number.isFinite(from.latitude) || !Number.isFinite(from.longitude) ||
    !Number.isFinite(to.latitude) || !Number.isFinite(to.longitude)
  ) {
    return Infinity;
  }

  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
