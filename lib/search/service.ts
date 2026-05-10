import type { Database as SqliteDatabase } from "better-sqlite3";

import { distanceMiles } from "@/lib/distance";
import { postcodeCoordinate, postcodeDistrict, normalizePostcode } from "@/lib/postcode";
import type { FixtureResult, SearchRequest } from "@/lib/types";

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
  price_label: string | null;
  amount_pence: number | null;
  source_url: string | null;
  verified_at: string | null;
  price_confidence: "verified" | "seed" | "unknown" | null;
  cached_distance_miles: number | null;
  driving_minutes: number | null;
  public_transport_minutes: number | null;
}

export function defaultDateRange(now = new Date()): { dateFrom: string; dateTo: string } {
  const from = new Date(now);
  const to = new Date(now);
  to.setDate(to.getDate() + 10);

  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10)
  };
}

export function searchFixtures(db: SqliteDatabase, request: SearchRequest): FixtureResult[] {
  const defaults = defaultDateRange();
  const dateRange = {
    dateFrom: request.dateFrom ?? defaults.dateFrom,
    dateTo: request.dateTo ?? defaults.dateTo
  };
  const normalized = normalizePostcode(request.postcode);
  const district = postcodeDistrict(normalized);
  const userLocation = postcodeCoordinate(normalized);

  return queryFixtures(db, dateRange, district)
    .map((row) => toResult(row, userLocation))
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
  db: SqliteDatabase,
  request: Required<Pick<SearchRequest, "dateFrom" | "dateTo">>,
  postcodeDistrictValue: string
): FixtureRow[] {
  return db.prepare(`
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
      ap.label as price_label,
      ap.amount_pence,
      ap.source_url,
      ap.verified_at,
      ap.confidence as price_confidence,
      tc.distance_miles as cached_distance_miles,
      tc.driving_minutes,
      tc.public_transport_minutes
    FROM fixtures f
    JOIN competitions c ON c.code = f.competition_code
    JOIN clubs home ON home.id = f.home_club_id
    JOIN clubs away ON away.id = f.away_club_id
    JOIN venues v ON v.id = f.venue_id
    LEFT JOIN admission_prices ap ON ap.club_id = home.id AND ap.label = 'Adult from'
    LEFT JOIN travel_cache tc ON tc.venue_id = v.id AND tc.postcode_district = @postcodeDistrict
    WHERE date(f.kickoff_at) BETWEEN date(@dateFrom) AND date(@dateTo)
      AND f.is_historical = 0
      AND f.status IN ('scheduled', 'finished')
    ORDER BY f.kickoff_at ASC
  `).all({
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    postcodeDistrict: postcodeDistrictValue
  }) as FixtureRow[];
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
      label: row.price_label ?? "Price unknown",
      amountPence: row.amount_pence,
      sourceUrl: row.source_url,
      verifiedAt: row.verified_at,
      confidence: row.price_confidence ?? "unknown"
    },
    travel: {
      distanceMiles: Math.round(distance * 10) / 10,
      drivingMinutes: row.driving_minutes,
      publicTransportMinutes: row.public_transport_minutes,
      source: row.cached_distance_miles === null ? "distance_only" : "cache"
    },
    isDemoData: row.is_demo_data === 1,
    isHistorical: row.is_historical === 1,
    warnings
  };
}
