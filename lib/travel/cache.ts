import type { AppDatabase, SqlWrite } from "../db/adapter.ts";
import { distanceMiles } from "../distance.ts";
import { postcodeCoordinate, postcodeDistrict, type Coordinate } from "../postcode.ts";
import { lookupTravelEstimate, type TravelProvidersConfig } from "./providers.ts";
import { defaultDateRange } from "../date.ts";

interface VenueRow {
  venue_id: number;
  venue_name: string;
  postcode?: string;
  latitude: number;
  longitude: number;
}

export interface TravelFillOptions extends TravelProvidersConfig {
  dateFrom?: string;
  dateTo?: string;
  fetchImpl?: typeof fetch;
}

export interface TravelFillResult {
  postcodeDistrict: string;
  venuesConsidered: number;
  rowsInserted: number;
  providerBackfilled: number;
  distanceOnlySkipped: number;
}

export interface TravelGroundsFillResult {
  districtsConsidered: number;
  rowsInserted: number;
  providerBackfilled: number;
  distanceOnlySkipped: number;
}

interface TravelCacheEntryInput {
  postcodeDistrictValue: string;
  origin: Coordinate;
  venue: VenueRow;
  providers: TravelProvidersConfig;
  fetchImpl?: typeof fetch;
}

export async function listMissingTravelCacheVenues(
  db: AppDatabase,
  postcodeDistrictValue: string,
  dateFrom: string,
  dateTo: string
): Promise<VenueRow[]> {
  return db.all<VenueRow>(`
    SELECT DISTINCT
      v.id as venue_id,
      v.name as venue_name,
      v.latitude,
      v.longitude
    FROM fixtures f
    JOIN venues v ON v.id = f.venue_id
    WHERE date(f.kickoff_at) BETWEEN date(?) AND date(?)
      AND f.is_historical = 0
      AND f.status IN ('scheduled', 'finished')
      AND NOT EXISTS (
        SELECT 1
        FROM travel_cache tc
        WHERE tc.postcode_district = ?
          AND tc.venue_id = v.id
      )
    ORDER BY v.id ASC
  `, [dateFrom, dateTo, postcodeDistrictValue]);
}

export async function listAllMissingTravelCacheVenues(
  db: AppDatabase,
  postcodeDistrictValue: string
): Promise<VenueRow[]> {
  return db.all<VenueRow>(`
    SELECT
      v.id as venue_id,
      v.name as venue_name,
      v.postcode,
      v.latitude,
      v.longitude
    FROM venues v
    WHERE NOT EXISTS (
      SELECT 1
      FROM travel_cache tc
      WHERE tc.postcode_district = ?
        AND tc.venue_id = v.id
    )
    ORDER BY v.id ASC
  `, [postcodeDistrictValue]);
}

export async function listGroundPostcodeDistricts(db: AppDatabase): Promise<string[]> {
  const rows = await db.all<{ postcode: string }>(`
    SELECT DISTINCT postcode
    FROM venues
    WHERE postcode IS NOT NULL AND postcode != ''
    ORDER BY postcode ASC
  `);

  return Array.from(new Set(rows.map((row) => postcodeDistrict(row.postcode))));
}

export async function upsertTravelCacheRow(
  db: AppDatabase,
  postcodeDistrictValue: string,
  venueId: number,
  distanceMilesValue: number,
  drivingMinutes: number | null,
  publicTransportMinutes: number | null,
  provider: string,
  calculatedAt: string
): Promise<void> {
  await db.run(`
    INSERT INTO travel_cache (
      postcode_district, venue_id, distance_miles, driving_minutes,
      public_transport_minutes, provider, calculated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(postcode_district, venue_id) DO UPDATE SET
      distance_miles = excluded.distance_miles,
      driving_minutes = excluded.driving_minutes,
      public_transport_minutes = excluded.public_transport_minutes,
      provider = excluded.provider,
      calculated_at = excluded.calculated_at
  `, [
    postcodeDistrictValue,
    venueId,
    distanceMilesValue,
    drivingMinutes,
    publicTransportMinutes,
    provider,
    calculatedAt
  ]);
}

export async function buildTravelCacheEntry(input: TravelCacheEntryInput): Promise<{
  venueId: number;
  distanceMiles: number;
  drivingMinutes: number | null;
  publicTransportMinutes: number | null;
  provider: string | null;
}> {
  const destination = {
    latitude: input.venue.latitude,
    longitude: input.venue.longitude
  };
  const estimate = await lookupTravelEstimate(input.origin, destination, input.providers, input.fetchImpl);

  return {
    venueId: input.venue.venue_id,
    distanceMiles: Math.round(distanceMiles(input.origin, destination) * 10) / 10,
    drivingMinutes: estimate.drivingMinutes,
    publicTransportMinutes: estimate.publicTransportMinutes,
    provider: estimate.provider
  };
}

export async function fillTravelCacheForPostcode(
  db: AppDatabase,
  postcode: string,
  options: TravelFillOptions = {}
): Promise<TravelFillResult> {
  const defaults = defaultDateRange();
  const dateFrom = options.dateFrom ?? defaults.dateFrom;
  const dateTo = options.dateTo ?? defaults.dateTo;
  const postcodeDistrictValue = postcodeDistrict(postcode);
  const origin = postcodeCoordinate(postcode);
  const venues = await listMissingTravelCacheVenues(db, postcodeDistrictValue, dateFrom, dateTo);

  let rowsInserted = 0;
  let providerBackfilled = 0;
  let distanceOnlySkipped = 0;
  const insertStatements: SqlWrite[] = [];

  for (const venue of venues) {
    const entry = await buildTravelCacheEntry({
      postcodeDistrictValue,
      origin,
      venue,
      providers: options,
      fetchImpl: options.fetchImpl
    });

    if (!entry.provider) {
      distanceOnlySkipped += 1;
      continue;
    }

    insertStatements.push({
      sql: `INSERT INTO travel_cache (
        postcode_district, venue_id, distance_miles, driving_minutes,
        public_transport_minutes, provider, calculated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(postcode_district, venue_id) DO UPDATE SET
        distance_miles = excluded.distance_miles,
        driving_minutes = excluded.driving_minutes,
        public_transport_minutes = excluded.public_transport_minutes,
        provider = excluded.provider,
        calculated_at = excluded.calculated_at`,
      params: [
        postcodeDistrictValue,
        entry.venueId,
        entry.distanceMiles,
        entry.drivingMinutes,
        entry.publicTransportMinutes,
        entry.provider,
        new Date().toISOString(),
      ],
    });
    rowsInserted += 1;
    providerBackfilled += 1;
  }

  if (insertStatements.length > 0) {
    await db.writeBatch(insertStatements);
  }

  return {
    postcodeDistrict: postcodeDistrictValue,
    venuesConsidered: venues.length,
    rowsInserted,
    providerBackfilled,
    distanceOnlySkipped
  };
}

export async function fillTravelCacheForDistrict(
  db: AppDatabase,
  postcodeDistrictValue: string,
  options: TravelFillOptions = {}
): Promise<TravelFillResult> {
  const origin = postcodeCoordinate(`${postcodeDistrictValue} 1AA`);
  const venues = await listAllMissingTravelCacheVenues(db, postcodeDistrictValue);

  let rowsInserted = 0;
  let providerBackfilled = 0;
  let distanceOnlySkipped = 0;
  const insertStatements: SqlWrite[] = [];

  for (const venue of venues) {
    const entry = await buildTravelCacheEntry({
      postcodeDistrictValue,
      origin,
      venue,
      providers: options,
      fetchImpl: options.fetchImpl
    });

    if (!entry.provider) {
      distanceOnlySkipped += 1;
      continue;
    }

    insertStatements.push({
      sql: `INSERT INTO travel_cache (
        postcode_district, venue_id, distance_miles, driving_minutes,
        public_transport_minutes, provider, calculated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(postcode_district, venue_id) DO UPDATE SET
        distance_miles = excluded.distance_miles,
        driving_minutes = excluded.driving_minutes,
        public_transport_minutes = excluded.public_transport_minutes,
        provider = excluded.provider,
        calculated_at = excluded.calculated_at`,
      params: [
        postcodeDistrictValue,
        entry.venueId,
        entry.distanceMiles,
        entry.drivingMinutes,
        entry.publicTransportMinutes,
        entry.provider,
        new Date().toISOString(),
      ],
    });
    rowsInserted += 1;
    providerBackfilled += 1;
  }

  if (insertStatements.length > 0) {
    await db.writeBatch(insertStatements);
  }

  return {
    postcodeDistrict: postcodeDistrictValue,
    venuesConsidered: venues.length,
    rowsInserted,
    providerBackfilled,
    distanceOnlySkipped
  };
}

export async function fillTravelCacheForGroundDistricts(
  db: AppDatabase,
  options: TravelFillOptions = {}
): Promise<TravelGroundsFillResult> {
  const districts = await listGroundPostcodeDistricts(db);
  let rowsInserted = 0;
  let providerBackfilled = 0;
  let distanceOnlySkipped = 0;

  for (const district of districts) {
    const result = await fillTravelCacheForDistrict(db, district, options);
    rowsInserted += result.rowsInserted;
    providerBackfilled += result.providerBackfilled;
    distanceOnlySkipped += result.distanceOnlySkipped;
  }

  return {
    districtsConsidered: districts.length,
    rowsInserted,
    providerBackfilled,
    distanceOnlySkipped
  };
}

export async function invalidateTravelCacheForVenue(
  db: AppDatabase,
  venueId: number
): Promise<number> {
  const result = await db.run(
    "DELETE FROM travel_cache WHERE venue_id = ?",
    [venueId]
  );

  return result.changes;
}
