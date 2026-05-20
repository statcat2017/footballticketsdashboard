import type { AppDatabase } from "./adapter.ts";

export interface DivisionSummary {
  id: number;
  code: string;
  name: string;
  level: number;
  club_count: number;
}

export interface DivisionDetailClub {
  clubId: number;
  clubName: string;
  venueName: string;
  venuePostcode: string;
  latitude: number;
  longitude: number;
  adultPricePence: number | null;
  concessionPricePence: number | null;
  saleMode: string | null;
  officialSiteUrl: string | null;
}

export interface DivisionDetail {
  id: number;
  code: string;
  name: string;
  level: number;
  clubs: DivisionDetailClub[];
}

interface DivisionSummaryRow {
  id: number;
  code: string;
  name: string;
  level: number;
  club_count: number;
}

interface ClubDetailRow {
  club_id: number;
  club_name: string;
  venue_name: string;
  venue_postcode: string;
  latitude: number | null;
  longitude: number | null;
  adult_price_pence: number | null;
  concession_price_pence: number | null;
  sale_mode: string | null;
  official_site_url: string | null;
}

interface DivisionRow {
  id: number;
  code: string;
  name: string;
  level: number;
}

export async function listDivisions(db: AppDatabase): Promise<DivisionSummary[]> {
  const rows = await db.all<DivisionSummaryRow>(
    `SELECT
      d.id, d.code, d.name, d.level,
      COUNT(da.id) AS club_count
    FROM pyramid_divisions d
    LEFT JOIN division_assignments da ON da.division_id = d.id
    GROUP BY d.id
    ORDER BY d.level, d.display_order`
  );

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    level: r.level,
    club_count: r.club_count
  }));
}

export async function getDivisionDetailByCode(
  db: AppDatabase,
  code: string
): Promise<DivisionDetail | null> {
  const division = await db.get<DivisionRow>(
    `SELECT id, code, name, level FROM pyramid_divisions WHERE code = ?`,
    [code]
  );

  if (!division) return null;

  const clubRows = await db.all<ClubDetailRow>(
    `SELECT
      c.id AS club_id,
      c.name AS club_name,
      v.name AS venue_name,
      v.postcode AS venue_postcode,
      v.latitude,
      v.longitude,
      ctp.adult_price_pence,
      ctp.concession_price_pence,
      ctp.sale_mode,
      c.official_site_url
    FROM division_assignments da
    JOIN clubs c ON c.id = da.club_id
    LEFT JOIN club_venue_assignments cva
      ON cva.club_id = c.id AND cva.is_primary = 1 AND cva.effective_to IS NULL
    LEFT JOIN venues v ON v.id = cva.venue_id
    LEFT JOIN club_ticket_prices ctp ON ctp.club_id = c.id
    WHERE da.division_id = ?
    ORDER BY c.name`,
    [division.id]
  );

  const clubs: DivisionDetailClub[] = clubRows.map((r) => ({
    clubId: r.club_id,
    clubName: r.club_name,
    venueName: r.venue_name ?? "TBC",
    venuePostcode: r.venue_postcode ?? "",
    latitude: r.latitude ?? 0,
    longitude: r.longitude ?? 0,
    adultPricePence: r.adult_price_pence ?? null,
    concessionPricePence: r.concession_price_pence ?? null,
    saleMode: r.sale_mode ?? null,
    officialSiteUrl: r.official_site_url ?? null
  }));

  return {
    id: division.id,
    code: division.code,
    name: division.name,
    level: division.level,
    clubs
  };
}
