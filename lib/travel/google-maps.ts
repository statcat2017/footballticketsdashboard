import type { Coordinate } from "../postcode.ts";

export function buildGoogleMapsTransitDirectionsUrl(from: Coordinate, to: Coordinate): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${from.latitude},${from.longitude}`,
    destination: `${to.latitude},${to.longitude}`,
    travelmode: "transit",
    dir_action: "navigate"
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
