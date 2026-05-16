import type { AppDatabase } from "./adapter.ts";
import type { AllocationType, MovementType } from "./pyramid.ts";

export interface ExplorerClubRow {
  id: number;
  name: string;
}

export interface ExplorerDivision {
  id: number;
  code: string;
  name: string;
  level: number;
  max_size: number;
  display_order: number | null;
  club_count: number;
  clubs: ExplorerClubRow[];
}

export interface ExplorerEdge {
  id: number;
  from_division_id: number;
  to_division_id: number;
  movement_type: MovementType;
  allocation_type: AllocationType;
  notes: string | null;
  source_url: string | null;
}

export interface ExplorerClubSearchRow {
  club_id: number;
  club_name: string;
  division_id: number;
  division_code: string;
  division_name: string;
  level: number;
}

export interface PyramidExplorerData {
  season: { id: number; label: string };
  divisions: ExplorerDivision[];
  edges: ExplorerEdge[];
  clubs: ExplorerClubSearchRow[];
}

interface DivisionRow {
  id: number;
  code: string;
  name: string;
  level: number;
  max_size: number;
  display_order: number | null;
  club_count: number;
}

interface ClubInDivisionRow {
  season_division_id: number;
  id: number;
  name: string;
}

interface EdgeRow {
  id: number;
  from_division_id: number;
  to_division_id: number;
  movement_type: MovementType;
  allocation_type: AllocationType;
  notes: string | null;
  source_url: string | null;
}

interface ClubSearchRow {
  club_id: number;
  club_name: string;
  division_id: number;
  division_code: string;
  division_name: string;
  level: number;
}

interface SeasonRow {
  id: number;
  season_label: string;
}

export async function getPyramidExplorerData(db: AppDatabase): Promise<PyramidExplorerData> {
  const seasons = await db.all<SeasonRow>(
    "SELECT id, season_label FROM pyramid_seasons ORDER BY id DESC LIMIT 1"
  );
  const season = seasons[0];
  if (!season) {
    return { season: { id: 0, label: "" }, divisions: [], edges: [], clubs: [] };
  }

  const divisions = await getExplorerDivisions(db, season.id);
  const edges = await db.all<EdgeRow>(
    "SELECT id, from_division_id, to_division_id, movement_type, allocation_type, notes, source_url FROM pyramid_edges ORDER BY id"
  );
  const clubs = await getClubSearchRows(db, season.id);

  return {
    season: { id: season.id, label: season.season_label },
    divisions,
    edges: edges.map(normaliseExplorerEdge),
    clubs: clubs.map(normaliseClubSearchRow)
  };
}

async function getExplorerDivisions(db: AppDatabase, seasonId: number): Promise<ExplorerDivision[]> {
  const rows = await db.all<DivisionRow>(
    `SELECT
      d.id, d.code, d.name, d.level, d.max_size, d.display_order,
      COUNT(pm.id) AS club_count
    FROM pyramid_divisions d
    LEFT JOIN pyramid_season_divisions psd ON psd.division_id = d.id AND psd.season_id = ?
    LEFT JOIN pyramid_season_memberships pm ON pm.season_division_id = psd.id
    GROUP BY d.id
    ORDER BY d.level, d.display_order`,
    [seasonId]
  );

  const clubRows = await db.all<ClubInDivisionRow>(
    `SELECT pm.season_division_id, pc.id, pc.name
    FROM pyramid_season_memberships pm
    JOIN pyramid_clubs pc ON pc.id = pm.club_id
    WHERE pm.season_id = ?
    ORDER BY pc.name`,
    [seasonId]
  );

  const clubsByDivision = new Map<number, ExplorerClubRow[]>();
  for (const cr of clubRows) {
    const list = clubsByDivision.get(cr.season_division_id) ?? [];
    list.push({ id: cr.id, name: cr.name });
    clubsByDivision.set(cr.season_division_id, list);
  }

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    level: r.level,
    max_size: r.max_size,
    display_order: r.display_order,
    club_count: r.club_count,
    clubs: clubsByDivision.get(r.id) ?? []
  }));
}

async function getClubSearchRows(db: AppDatabase, seasonId: number): Promise<ClubSearchRow[]> {
  return db.all<ClubSearchRow>(
    `SELECT
      pc.id AS club_id,
      pc.name AS club_name,
      d.id AS division_id,
      d.code AS division_code,
      d.name AS division_name,
      d.level
    FROM pyramid_season_memberships pm
    JOIN pyramid_clubs pc ON pc.id = pm.club_id
    JOIN pyramid_season_divisions psd ON psd.id = pm.season_division_id
    JOIN pyramid_divisions d ON d.id = psd.division_id
    WHERE pm.season_id = ?
    ORDER BY pc.name`,
    [seasonId]
  );
}

function normaliseExplorerEdge(row: EdgeRow): ExplorerEdge {
  return {
    id: row.id,
    from_division_id: row.from_division_id,
    to_division_id: row.to_division_id,
    movement_type: row.movement_type,
    allocation_type: row.allocation_type,
    notes: row.notes,
    source_url: row.source_url
  };
}

function normaliseClubSearchRow(row: ClubSearchRow): ExplorerClubSearchRow {
  return {
    club_id: row.club_id,
    club_name: row.club_name,
    division_id: row.division_id,
    division_code: row.division_code,
    division_name: row.division_name,
    level: row.level
  };
}
