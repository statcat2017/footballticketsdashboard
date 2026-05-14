import type { AppDatabase } from "../db/adapter.ts";
import { distanceMiles } from "../distance.ts";
import { resolvePostcodeOrigin } from "../postcode.ts";
import { buildTravelCacheEntry, upsertTravelCacheRow } from "../travel/cache.ts";
import type { FixtureResult, SearchRequest } from "../types.ts";
import type { TravelProviderRuntimeConfig } from "../runtime-env.ts";
import { defaultDateRange } from "../date.ts";

interface FixtureRow {
  id: number;
  competition_code: "PL" | "ELC";
  competition_name: string;
  kickoff_at: string | null;
  is_demo_data: 0 | 1;
  is_historical: 0 | 1;
  home_club: string;
  away_club: string;
  official_site_url: string | null;
  generic_ticket_url: string | null;
  venue_id: number;
  venue_name: string;
  venue_postcode: string;
  latitude: number;
  longitude: number;
  sale_mode: "all_ticket" | "pay_on_gate" | null;
  adult_price_pence: number | null;
  concession_price_pence: number | null;
  source_url: string | null;
  verified_at: string | null;
  price_confidence: "verified" | "seed" | "unknown" | null;
  has_price_override: number;
  cached_distance_miles: number | null;
  driving_minutes: number | null;
  public_transport_minutes: number | null;
  travel_source?: "cache" | "live" | "distance_only";
}

export async function searchFixtures(
  db: AppDatabase,
  request: SearchRequest,
  options: { travelProviders?: TravelProviderRuntimeConfig } = {}
): Promise<FixtureResult[]> {
  const defaults = defaultDateRange();
  const dateRange = {
    dateFrom: request.dateFrom ?? defaults.dateFrom,
    dateTo: request.dateTo ?? defaults.dateTo
  };
  const origin = await resolvePostcodeOrigin(request.postcode);

  const rows = await queryFixtures(db, dateRange, origin.district);

  const radiusFilter = request.radiusMiles;
  const inRadius = radiusFilter === undefined
    ? rows
    : rows.filter((row) => {
        const dist = row.cached_distance_miles ?? distanceMiles(origin.coordinate, {
          latitude: row.latitude,
          longitude: row.longitude
        });
        return dist <= radiusFilter;
      });

  const enrichedRows = await enrichTravelRows(db, inRadius, origin, options.travelProviders);

  return enrichedRows
    .map((row) => toResult(row, origin.coordinate))
    .filter((result) => request.radiusMiles === undefined || result.travel.distanceMiles <= request.radiusMiles)
    .sort((first, second) => {
      const distance = first.travel.distanceMiles - second.travel.distanceMiles;

      if (distance !== 0) {
        return distance;
      }

      return (first.kickoffAt ?? "").localeCompare(second.kickoffAt ?? "");
    });
}

function queryFixtures(
  db: AppDatabase,
  request: Required<Pick<SearchRequest, "dateFrom" | "dateTo">>,
  postcodeDistrictValue: string
): Promise<FixtureRow[]> {
  return db.all<FixtureRow>(`
    SELECT
      f.id,
      f.competition_code,
      c.name as competition_name,
      f.kickoff_at,
      f.is_demo_data,
      f.is_historical,
      home.name as home_club,
      away.name as away_club,
      home.official_site_url,
      home.generic_ticket_url,
      v.id as venue_id,
      v.name as venue_name,
      v.postcode as venue_postcode,
      v.latitude,
      v.longitude,
      COALESCE(fpo.sale_mode, ctp.sale_mode) as sale_mode,
      COALESCE(fpo.adult_price_pence, ctp.adult_price_pence) as adult_price_pence,
      COALESCE(fpo.concession_price_pence, ctp.concession_price_pence) as concession_price_pence,
      COALESCE(fpo.source_url, ctp.source_url) as source_url,
      COALESCE(fpo.verified_at, ctp.verified_at) as verified_at,
      COALESCE(fpo.confidence, ctp.confidence) as price_confidence,
      CASE WHEN fpo.fixture_id IS NULL THEN 0 ELSE 1 END as has_price_override,
      tc.distance_miles as cached_distance_miles,
      tc.driving_minutes,
      tc.public_transport_minutes
    FROM fixtures f
    JOIN competitions c ON c.code = f.competition_code
    JOIN clubs home ON home.id = f.home_club_id
    JOIN clubs away ON away.id = f.away_club_id
    JOIN venues v ON v.id = f.venue_id
    LEFT JOIN club_ticket_prices ctp ON ctp.club_id = home.id
    LEFT JOIN fixture_ticket_price_overrides fpo ON fpo.fixture_id = f.id
    LEFT JOIN travel_cache tc ON tc.venue_id = v.id AND tc.postcode_district = ?
    WHERE date(f.kickoff_at) BETWEEN date(?) AND date(?)
      AND f.is_historical = 0
      AND f.status = 'scheduled'
    ORDER BY f.kickoff_at ASC
  `, [
    postcodeDistrictValue,
    request.dateFrom,
    request.dateTo
  ]);
}

function toResult(row: FixtureRow, userLocation: { latitude: number; longitude: number }): FixtureResult {
  const calculatedDistance = distanceMiles(userLocation, {
    latitude: row.latitude,
    longitude: row.longitude
  });
  const distance = row.cached_distance_miles ?? calculatedDistance;
  const warnings: string[] = [
    "Admission prices are best-effort guide prices. Confirm with the club before travelling."
  ];

  if (row.is_historical) {
    warnings.push("Historical fixture shown because no live fixtures match the current window.");
  }

  if (row.cached_distance_miles === null) {
    warnings.push("Travel time unavailable for this postcode district; showing straight-line distance only.");
  }

  return {
    id: row.id,
    title: `${row.home_club} vs ${row.away_club}`,
    competitionCode: row.competition_code,
    competitionName: row.competition_name,
    kickoffAt: row.kickoff_at,
    venueName: row.venue_name,
    venuePostcode: row.venue_postcode,
    homeClub: row.home_club,
    awayClub: row.away_club,
    officialSiteUrl: row.official_site_url,
    genericTicketUrl: row.generic_ticket_url,
    price: {
      saleMode: row.sale_mode,
      adultPricePence: row.adult_price_pence,
      concessionPricePence: row.concession_price_pence,
      sourceUrl: row.source_url,
      verifiedAt: row.verified_at,
      confidence: row.price_confidence ?? "unknown",
      isOverride: row.has_price_override === 1
    },
    travel: {
      distanceMiles: Math.round(distance * 10) / 10,
      drivingMinutes: row.driving_minutes,
      publicTransportMinutes: row.public_transport_minutes,
      source: row.travel_source ?? (row.cached_distance_miles === null ? "distance_only" : "cache")
    },
    isDemoData: row.is_demo_data === 1,
    isHistorical: row.is_historical === 1,
    warnings
  };
}

async function enrichTravelRows(
  db: AppDatabase,
  rows: FixtureRow[],
  origin: Awaited<ReturnType<typeof resolvePostcodeOrigin>>,
  travelProviders?: TravelProviderRuntimeConfig
): Promise<FixtureRow[]> {
  const apiKey = travelProviders?.openRouteServiceApiKey;

  if (!apiKey) {
    return rows;
  }

  const byVenue = new Map<number, () => ReturnType<typeof buildTravelCacheEntry>>();

  for (const row of rows) {
    if (row.cached_distance_miles !== null || byVenue.has(row.venue_id)) {
      continue;
    }

    byVenue.set(row.venue_id, () => buildTravelCacheEntry({
      postcodeDistrictValue: origin.district,
      origin: origin.coordinate,
      venue: {
        venue_id: row.venue_id,
        venue_name: row.venue_name,
        latitude: row.latitude,
        longitude: row.longitude
      },
      providers: { openRouteServiceApiKey: apiKey }
    }));
  }

  const MAX_CONCURRENT = 4;
  const venueArray = Array.from(byVenue.entries());
  const entryResults: Array<readonly [number, Awaited<ReturnType<typeof buildTravelCacheEntry>>]> = [];

  for (let i = 0; i < venueArray.length; i += MAX_CONCURRENT) {
    const chunk = venueArray.slice(i, i + MAX_CONCURRENT);
    const chunkResults = await Promise.all(chunk.map(async ([venueId, buildEntry]) => {
      const entry = await buildEntry();
      if (entry.provider) {
        try {
          await upsertTravelCacheRow(
            db,
            origin.district,
            venueId,
            entry.distanceMiles,
            entry.drivingMinutes,
            entry.publicTransportMinutes,
            entry.provider,
            new Date().toISOString()
          );
        } catch (error) {
          console.error("failed to cache travel entry for venue", venueId, error);
        }
      }
      return [venueId, entry] as const;
    }));
    entryResults.push(...chunkResults);
  }
  const entries = new Map(entryResults);

  return rows.map((row) => {
    if (row.cached_distance_miles !== null) {
      return { ...row, travel_source: "cache" };
    }

    const entry = entries.get(row.venue_id);

    if (!entry?.provider) {
      return { ...row, travel_source: "distance_only" };
    }

    return {
      ...row,
      cached_distance_miles: entry.distanceMiles,
      driving_minutes: entry.drivingMinutes,
      public_transport_minutes: entry.publicTransportMinutes,
      travel_source: "live"
    };
  });
}
