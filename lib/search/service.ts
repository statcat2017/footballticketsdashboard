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
import { buildGoogleMapsTransitDirectionsUrl } from "../travel/google-maps.ts";
import type { FixtureResult, SearchRequest } from "../types.ts";
import { defaultDateRange } from "../date.ts";

const STALE_TRAVEL_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

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
  travel_calculated_at: string | null;
}

export async function searchFixtures(
  db: AppDatabase,
  request: SearchRequest,
  options: {
    postcodeResolver?: PostcodeResolver;
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

  rows = rows.filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));

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

  return inRadius
    .map((row) => toResult(row, origin))
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
      tc.calculated_at as travel_calculated_at
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
      tc.calculated_at as travel_calculated_at
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

function toResult(row: FixtureRow, origin: ResolvedPostcodeOrigin): FixtureResult {
  const calculatedDistance = distanceMiles(origin.coordinate, {
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

  const source = row.cached_distance_miles === null ? "distance_only" : "cache";
  const calculatedAt = row.travel_calculated_at;
  const calculatedAtTime = calculatedAt ? Date.parse(calculatedAt) : Number.NaN;
  const isStale = source === "cache"
    && (!Number.isFinite(calculatedAtTime) || Date.now() - calculatedAtTime > STALE_TRAVEL_AFTER_MS);
  const isPartial = source === "cache"
    && (row.driving_minutes === null || row.public_transport_minutes === null);

  if (isPartial) {
    warnings.push("Some travel modes are unavailable for this postcode district.");
  }

  if (isStale) {
    warnings.push("Travel estimate may be out of date.");
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
      publicTransportUrl: buildGoogleMapsTransitDirectionsUrl(origin.coordinate, {
        latitude: row.latitude,
        longitude: row.longitude
      }),
      source,
      postcodeDistrict: origin.district,
      isDistrictApproximate: source === "cache" || origin.source === "fallback",
      isPartial,
      isStale,
      calculatedAt
    },
    isDemoData: row.is_demo_data === 1,
    isHistorical: row.is_historical === 1,
    warnings
  };
}
