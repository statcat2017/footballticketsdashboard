const EARTH_RADIUS_MILES = 3958.8;

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMiles(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const deltaLatitude = degreesToRadians(to.latitude - from.latitude);
  const deltaLongitude = degreesToRadians(to.longitude - from.longitude);
  const fromLatitude = degreesToRadians(from.latitude);
  const toLatitude = degreesToRadians(to.latitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
