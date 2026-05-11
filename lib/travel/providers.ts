import type { Coordinate } from "../postcode.ts";

export interface TravelProvidersConfig {
  openRouteServiceApiKey?: string;
  travelTimeAppId?: string;
  travelTimeApiKey?: string;
}

export interface TravelEstimate {
  drivingMinutes: number | null;
  publicTransportMinutes: number | null;
  provider: string | null;
}

interface FetchJsonOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  fetchImpl?: typeof fetch;
}

function nextWeekdayMorningIso(now = new Date()): string {
  const value = new Date(now);
  value.setUTCDate(value.getUTCDate() + 1);
  value.setUTCHours(9, 0, 0, 0);

  while (value.getUTCDay() === 0 || value.getUTCDay() === 6) {
    value.setUTCDate(value.getUTCDate() + 1);
  }

  return value.toISOString();
}

async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const response = await (options.fetchImpl ?? fetch)(url, {
    method: options.method ?? "GET",
    headers: options.headers,
    body: options.body
  });

  if (!response.ok) {
    throw new Error(`Provider request failed with ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

export async function lookupOpenRouteServiceDrivingMinutes(
  from: Coordinate,
  to: Coordinate,
  apiKey: string,
  fetchImpl?: typeof fetch
): Promise<number> {
  const payload = await fetchJson<{
    routes?: Array<{
      summary?: {
        duration?: number;
      };
    }>;
  }>("https://api.openrouteservice.org/v2/directions/driving-car", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      coordinates: [
        [from.longitude, from.latitude],
        [to.longitude, to.latitude]
      ]
    }),
    fetchImpl
  });

  const durationSeconds = payload.routes?.[0]?.summary?.duration;

  if (typeof durationSeconds !== "number") {
    throw new Error("OpenRouteService response did not include a route duration.");
  }

  return Math.round(durationSeconds / 60);
}

export async function lookupTravelTimePublicTransportMinutes(
  from: Coordinate,
  to: Coordinate,
  appId: string,
  apiKey: string,
  fetchImpl?: typeof fetch
): Promise<number> {
  const payload = await fetchJson<{
    results?: Array<{
      locations?: Array<{
        properties?: Array<{
          travel_time?: number;
        }>;
      }>;
    }>;
  }>("https://api.traveltimeapp.com/v4/time-filter", {
    method: "POST",
    headers: {
      "X-Application-Id": appId,
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      locations: [
        {
          id: "origin",
          coords: {
            lat: from.latitude,
            lng: from.longitude
          }
        },
        {
          id: "destination",
          coords: {
            lat: to.latitude,
            lng: to.longitude
          }
        }
      ],
      departure_searches: [
        {
          id: "origin-to-destination",
          departure_location_id: "origin",
          arrival_location_ids: ["destination"],
          transportation: {
            type: "public_transport"
          },
          departure_time: nextWeekdayMorningIso(),
          properties: ["travel_time"]
        }
      ]
    }),
    fetchImpl
  });

  const travelTimeSeconds = payload.results?.[0]?.locations?.[0]?.properties?.[0]?.travel_time;

  if (typeof travelTimeSeconds !== "number") {
    throw new Error("TravelTime response did not include a public transport duration.");
  }

  return Math.round(travelTimeSeconds / 60);
}

export async function lookupTravelEstimate(
  from: Coordinate,
  to: Coordinate,
  config: TravelProvidersConfig,
  fetchImpl?: typeof fetch
): Promise<TravelEstimate> {
  const results = await Promise.allSettled([
    config.openRouteServiceApiKey
      ? lookupOpenRouteServiceDrivingMinutes(from, to, config.openRouteServiceApiKey, fetchImpl)
      : Promise.resolve(null),
    config.travelTimeAppId && config.travelTimeApiKey
      ? lookupTravelTimePublicTransportMinutes(from, to, config.travelTimeAppId, config.travelTimeApiKey, fetchImpl)
      : Promise.resolve(null)
  ]);

  const drivingMinutes = results[0]?.status === "fulfilled" ? results[0].value : null;
  const publicTransportMinutes = results[1]?.status === "fulfilled" ? results[1].value : null;

  const providers: string[] = [];

  if (drivingMinutes !== null) {
    providers.push("openrouteservice");
  }

  if (publicTransportMinutes !== null) {
    providers.push("traveltime");
  }

  return {
    drivingMinutes,
    publicTransportMinutes,
    provider: providers.length > 0 ? providers.join("+") : null
  };
}
