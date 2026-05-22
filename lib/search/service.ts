import type { AppDatabase } from "../db/adapter.ts";
import { distanceMiles } from "../distance.ts";
import {
  resolvePostcodeOrigin,
  normalizePostcode,
  postcodeDistrict,
  districtFallbackCoordinate,
  type PostcodeResolver,
  type ResolvedPostcodeOrigin
} from "../postcode.ts";
import { buildTravelCacheEntry, upsertTravelCacheRow } from "../travel/cache.ts";
import type { TravelProvider } from "../travel/providers.ts";
import { buildGoogleMapsTransitDirectionsUrl } from "../travel/google-maps.ts";
import type { FixtureResult, SearchRequest } from "../types.ts";
import type { TravelProviderRuntimeConfig } from "../runtime-env.ts";
import { defaultDateRange } from "../date.ts";

interface FixtureRow {
  id: number;
  competition_code: string;
  competition_name: string;
  kickoff_at: string | null;
  fixture_date: string | null;
  kickoff_time: string | null;
  kickoff_time_status: "confirmed" | "assumed" | "unknown" | null;
  season_label: string | null;
  is_demo_data: 0 | 1;
  is_historical: 0 | 1;
  home_club: string;
  away_club: string;
  home_one_off: 0 | 1;
  away_one_off: 0 | 1;
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
  price_confidence: "verified" | "imported" | "inferred" | "approximate" | "unknown" | null;
  has_price_override: number;
  price_override_note: string | null;
  cached_distance_miles: number | null;
  driving_minutes: number | null;
  public_transport_minutes: number | null;
  cached_provider: string | null;
  travel_source?: "cache" | "live" | "distance_only";
}

function mergeProviders(...providers: Array<string | null | undefined>): string | null {
  const merged: string[] = [];

  for (const provider of providers) {
    if (!provider) {
      continue;
    }

    for (const part of provider.split("+")) {
      if (part && !merged.includes(part)) {
        merged.push(part);
      }
    }
  }

  return merged.length > 0 ? merged.join("+") : null;
}

export async function searchFixtures(
  db: AppDatabase,
  request: SearchRequest,
  options: {
    travelProviders?: TravelProviderRuntimeConfig;
    postcodeResolver?: PostcodeResolver;
    /** Replaces the entire travel provider pipeline for testing. */
    travelProviderOverrides?: TravelProvider[];
  } = {}
): Promise<FixtureResult[]> {
  const defaults = defaultDateRange();
  const dateRange = {
    dateFrom: request.dateFrom ?? defaults.dateFrom,
    dateTo: request.dateTo ?? defaults.dateTo
  };

  let origin: ResolvedPostcodeOrigin;

  if (options.postcodeResolver) {
    const normalized = normalizePostcode(request.postcode);
    const district = postcodeDistrict(normalized);
    const coordinate = await options.postcodeResolver.resolve(normalized);

    if (!coordinate) {
      origin = { normalized, district, coordinate: districtFallbackCoordinate(district), source: "fallback" };
    } else {
      origin = { normalized, district, coordinate, source: "known" };
    }
  } else {
    origin = await resolvePostcodeOrigin(request.postcode);
  }

  let rows = await queryFixtures(db, dateRange, origin.district);

  if (rows.length === 0) {
    rows = await queryFixtures(db, dateRange, origin.district, true);
  }

  if (rows.length === 0) {
    rows = await queryAllHistoricalFixtures(db, origin.district);
  }

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

  const enrichedRows = await enrichTravelRows(db, inRadius, origin, options.travelProviders, options.travelProviderOverrides);

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
  postcodeDistrictValue: string,
  includeHistorical = false
): Promise<FixtureRow[]> {
  return db.all<FixtureRow>(`
    SELECT
      f.id,
      f.competition_code,
      c.name as competition_name,
      f.kickoff_at,
      f.is_demo_data,
      f.is_historical,
      COALESCE(home.name, f.home_one_off_name) as home_club,
      COALESCE(away.name, f.away_one_off_name) as away_club,
      f.home_one_off,
      f.away_one_off,
      f.fixture_date,
      f.kickoff_time,
      f.kickoff_time_status,
      f.season_label,
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
      fpo.note as price_override_note,
      tc.distance_miles as cached_distance_miles,
      tc.driving_minutes,
      tc.public_transport_minutes,
      tc.provider as cached_provider
    FROM fixtures f
    JOIN competitions c ON c.code = f.competition_code
    LEFT JOIN clubs home ON home.id = f.home_club_id
    LEFT JOIN clubs away ON away.id = f.away_club_id
    JOIN venues v ON v.id = f.venue_id
    LEFT JOIN club_ticket_prices ctp ON ctp.club_id = home.id
    LEFT JOIN fixture_ticket_price_overrides fpo ON fpo.fixture_id = f.id
    LEFT JOIN travel_cache tc ON tc.venue_id = v.id AND tc.postcode_district = ?
    WHERE (
      (f.kickoff_at >= ? AND f.kickoff_at < date(?, '+1 day'))
      OR (f.kickoff_at IS NULL AND f.fixture_date BETWEEN ? AND ?)
    )
      ${includeHistorical ? "AND f.is_historical = 1" : "AND f.is_historical = 0 AND f.status = 'scheduled'"}
    ORDER BY COALESCE(f.kickoff_at, f.fixture_date) ASC
  `, [
    postcodeDistrictValue,
    request.dateFrom,
    request.dateTo,
    request.dateFrom,
    request.dateTo
  ]);
}

function queryAllHistoricalFixtures(
  db: AppDatabase,
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
      COALESCE(home.name, f.home_one_off_name) as home_club,
      COALESCE(away.name, f.away_one_off_name) as away_club,
      f.home_one_off,
      f.away_one_off,
      f.fixture_date,
      f.kickoff_time,
      f.kickoff_time_status,
      f.season_label,
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
      fpo.note as price_override_note,
      tc.distance_miles as cached_distance_miles,
      tc.driving_minutes,
      tc.public_transport_minutes,
      tc.provider as cached_provider
    FROM fixtures f
    JOIN competitions c ON c.code = f.competition_code
    LEFT JOIN clubs home ON home.id = f.home_club_id
    LEFT JOIN clubs away ON away.id = f.away_club_id
    JOIN venues v ON v.id = f.venue_id
    LEFT JOIN club_ticket_prices ctp ON ctp.club_id = home.id
    LEFT JOIN fixture_ticket_price_overrides fpo ON fpo.fixture_id = f.id
    LEFT JOIN travel_cache tc ON tc.venue_id = v.id AND tc.postcode_district = ?
    WHERE f.is_historical = 1
    ORDER BY COALESCE(f.kickoff_at, f.fixture_date) DESC
    LIMIT 50
  `, [postcodeDistrictValue]);
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

  if (row.home_one_off === 1 && row.generic_ticket_url === null) {
    warnings.push("One-off fixture: check the fixture source for ticket information.");
  }

  return {
    id: row.id,
    title: `${row.home_club} vs ${row.away_club}`,
    competitionCode: row.competition_code,
    competitionName: row.competition_name,
    kickoffAt: row.kickoff_at,
    fixtureDate: row.fixture_date,
    kickoffTime: row.kickoff_time,
    kickoffTimeStatus: row.kickoff_time_status,
    seasonLabel: row.season_label,
    homeOneOff: row.home_one_off === 1,
    awayOneOff: row.away_one_off === 1,
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
      isOverride: row.has_price_override === 1,
      overrideNote: row.price_override_note
    },
    travel: {
      distanceMiles: Math.round(distance * 10) / 10,
      drivingMinutes: row.driving_minutes,
      publicTransportMinutes: row.public_transport_minutes,
      publicTransportUrl: row.public_transport_minutes === null
        ? buildGoogleMapsTransitDirectionsUrl(userLocation, {
            latitude: row.latitude,
            longitude: row.longitude
          })
        : null,
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
  origin: ResolvedPostcodeOrigin,
  travelProviders?: TravelProviderRuntimeConfig,
  travelProviderOverrides?: TravelProvider[]
): Promise<FixtureRow[]> {
  const byVenue = new Map<number, {
    row: FixtureRow;
    buildEntry: () => ReturnType<typeof buildTravelCacheEntry>;
  }>();

  for (const row of rows) {
    const hasCachedTravel = row.cached_distance_miles !== null
      && row.driving_minutes !== null
      && row.public_transport_minutes !== null;

    if (hasCachedTravel || byVenue.has(row.venue_id)) {
      continue;
    }

    byVenue.set(row.venue_id, {
      row,
      buildEntry: () => travelProviderOverrides
        ? buildEntryWithOverrides(travelProviderOverrides, origin, row)
        : buildTravelCacheEntry({
            postcodeDistrictValue: origin.district,
            origin: origin.coordinate,
            venue: {
              venue_id: row.venue_id,
              venue_name: row.venue_name,
              latitude: row.latitude,
              longitude: row.longitude
            },
            providers: travelProviders ?? {}
          })
    });
  }

  const MAX_CONCURRENT = 4;
  const venueArray = Array.from(byVenue.entries());
  const entryResults: Array<readonly [number, Awaited<ReturnType<typeof buildTravelCacheEntry>>]> = [];

  for (let i = 0; i < venueArray.length; i += MAX_CONCURRENT) {
    const chunk = venueArray.slice(i, i + MAX_CONCURRENT);
    const chunkResults = await Promise.all(chunk.map(async ([venueId, { row, buildEntry }]) => {
      const entry = await buildEntry();
      if (entry.provider) {
        const mergedDistanceMiles = row.cached_distance_miles ?? entry.distanceMiles;
        const mergedDrivingMinutes = row.driving_minutes ?? entry.drivingMinutes;
        const mergedPublicTransportMinutes = row.public_transport_minutes ?? entry.publicTransportMinutes;
        const mergedProvider = mergeProviders(row.cached_provider, entry.provider);

        try {
          await upsertTravelCacheRow(
            db,
            origin.district,
            venueId,
            mergedDistanceMiles,
            mergedDrivingMinutes,
            mergedPublicTransportMinutes,
            mergedProvider ?? entry.provider,
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
    const entry = entries.get(row.venue_id);

    if (!entry?.provider) {
      if (row.cached_distance_miles !== null) {
        return { ...row, travel_source: "cache" };
      }

      return { ...row, travel_source: "distance_only" };
    }

    const mergedDistanceMiles = row.cached_distance_miles ?? entry.distanceMiles;
    const mergedDrivingMinutes = row.driving_minutes ?? entry.drivingMinutes;
    const mergedPublicTransportMinutes = row.public_transport_minutes ?? entry.publicTransportMinutes;
    const mergedProvider = mergeProviders(row.cached_provider, entry.provider);

    return {
      ...row,
      cached_distance_miles: mergedDistanceMiles,
      driving_minutes: mergedDrivingMinutes,
      public_transport_minutes: mergedPublicTransportMinutes,
      cached_provider: mergedProvider,
      travel_source: row.cached_distance_miles !== null ? "cache" : "live"
    };
  });
}

async function buildEntryWithOverrides(
  providers: TravelProvider[],
  origin: ResolvedPostcodeOrigin,
  row: FixtureRow
): Promise<{
  venueId: number;
  distanceMiles: number;
  drivingMinutes: number | null;
  publicTransportMinutes: number | null;
  provider: string | null;
}> {
  const destination = { latitude: row.latitude, longitude: row.longitude };
  const results = await Promise.allSettled(
    providers.map(p => p.estimate(origin.coordinate, destination))
  );

  let drivingMinutes: number | null = null;
  let publicTransportMinutes: number | null = null;
  const providerNames: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      const estimate = result.value;
      if (estimate.drivingMinutes !== null) drivingMinutes = estimate.drivingMinutes;
      if (estimate.publicTransportMinutes !== null) publicTransportMinutes = estimate.publicTransportMinutes;
      if (estimate.provider) providerNames.push(estimate.provider);
    }
  }

  const distanceMilesValue = Math.round(distanceMiles(origin.coordinate, destination) * 10) / 10;

  return {
    venueId: row.venue_id,
    distanceMiles: distanceMilesValue,
    drivingMinutes,
    publicTransportMinutes,
    provider: providerNames.length > 0 ? providerNames.join("+") : null
  };
}
