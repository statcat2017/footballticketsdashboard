import type { AppDatabase } from "@/lib/db/adapter";

export interface BasicClub {
  id: number;
  name: string;
}

export interface BasicDivision {
  id: number;
  name: string;
  level: number;
}

export interface DivisionWithMaxSize extends BasicDivision {
  max_size: number;
}

export interface DivisionAssignment {
  id: number;
  division_id: number;
}

export interface ClubCount {
  count: number;
}

export interface Edge {
  id: number;
}

export interface MovementSlot {
  id: number;
  source_division_id: number;
  target_division_id: number;
  movement_type: string;
  club_id: number | null;
}

export function getClubById(db: AppDatabase, clubId: number): Promise<BasicClub | undefined> {
  return db.get<BasicClub>("SELECT id, name FROM clubs WHERE id = ?", [clubId]);
}

export function getDivisionById(db: AppDatabase, divisionId: number): Promise<BasicDivision | undefined> {
  return db.get<BasicDivision>("SELECT id, name, level FROM pyramid_divisions WHERE id = ?", [divisionId]);
}

export function getDivisionByIdWithMaxSize(db: AppDatabase, divisionId: number): Promise<DivisionWithMaxSize | undefined> {
  return db.get<DivisionWithMaxSize>("SELECT id, name, level, max_size FROM pyramid_divisions WHERE id = ?", [divisionId]);
}

export function getDivisionByNameWithMaxSize(db: AppDatabase, divisionId: number): Promise<{ name: string; max_size: number } | undefined> {
  return db.get<{ name: string; max_size: number }>("SELECT name, max_size FROM pyramid_divisions WHERE id = ?", [divisionId]);
}

export function getDivisionAssignmentByClubId(db: AppDatabase, clubId: number): Promise<DivisionAssignment | undefined> {
  return db.get<DivisionAssignment>("SELECT id, division_id FROM division_assignments WHERE club_id = ?", [clubId]);
}

export function getDivisionIdByClubId(db: AppDatabase, clubId: number): Promise<{ division_id: number } | undefined> {
  return db.get<{ division_id: number }>("SELECT division_id FROM division_assignments WHERE club_id = ?", [clubId]);
}

export function getClubCountInDivision(db: AppDatabase, divisionId: number): Promise<ClubCount | undefined> {
  return db.get<ClubCount>("SELECT COUNT(*) AS count FROM division_assignments WHERE division_id = ?", [divisionId]);
}

export function getEdgeByFromToType(db: AppDatabase, fromDivisionId: number, toDivisionId: number, movementType: string): Promise<Edge | undefined> {
  return db.get<Edge>(
    "SELECT id FROM pyramid_edges WHERE from_division_id = ? AND to_division_id = ? AND movement_type = ?",
    [fromDivisionId, toDivisionId, movementType]
  );
}

export function getMovementSlotById(db: AppDatabase, slotId: number): Promise<MovementSlot | undefined> {
  return db.get<MovementSlot>(
    "SELECT id, source_division_id, target_division_id, movement_type, club_id FROM movement_slots WHERE id = ?",
    [slotId]
  );
}

export function getMovementSlotByClubIdExcluding(db: AppDatabase, clubId: number, excludeSlotId: number): Promise<Edge | undefined> {
  return db.get<Edge>(
    "SELECT id FROM movement_slots WHERE club_id = ? AND id != ? AND club_id IS NOT NULL",
    [clubId, excludeSlotId]
  );
}

export function getMovementSlotByClubIdAll(db: AppDatabase, clubId: number, excludeSlotId: number): Promise<Edge | undefined> {
  return db.get<Edge>(
    "SELECT id FROM movement_slots WHERE club_id = ? AND id != ?",
    [clubId, excludeSlotId]
  );
}

export function getExistingSlotIndices(db: AppDatabase, sourceDivisionId: number, targetDivisionId: number, movementType: string): Promise<{ slot_index: number }[]> {
  return db.all<{ slot_index: number }>(
    "SELECT slot_index FROM movement_slots WHERE source_division_id = ? AND target_division_id = ? AND movement_type = ?",
    [sourceDivisionId, targetDivisionId, movementType]
  );
}

export interface ClubsInDivisionRow {
  id: number;
  name: string;
}

export function getClubsInDivision(db: AppDatabase, divisionId: number): Promise<ClubsInDivisionRow[]> {
  return db.all<ClubsInDivisionRow>(
    `SELECT c.id, c.name
     FROM division_assignments da
     JOIN clubs c ON c.id = da.club_id
     WHERE da.division_id = ?
     ORDER BY c.name`,
    [divisionId]
  );
}

export interface CurrentDivisionInfo {
  id: number;
  name: string;
  level: number;
}

export interface ClubWithDivisionAssignment {
  id: number;
  name: string;
  division_id: number;
}

export interface DivisionTarget {
  id: number;
  name: string;
  level: number;
  max_size: number;
}

export function getCurrentDivisionOfClub(db: AppDatabase, clubId: number): Promise<CurrentDivisionInfo | undefined> {
  return db.get<CurrentDivisionInfo>(
    `SELECT pd.id, pd.name, pd.level
     FROM division_assignments da
     JOIN pyramid_divisions pd ON pd.id = da.division_id
     WHERE da.club_id = ?`,
    [clubId]
  );
}

export function getClubWithDivisionAssignment(db: AppDatabase, clubId: number): Promise<ClubWithDivisionAssignment | undefined> {
  return db.get<ClubWithDivisionAssignment>(
    `SELECT c.id, c.name, da.division_id
     FROM division_assignments da
     JOIN clubs c ON c.id = da.club_id
     WHERE da.club_id = ?`,
    [clubId]
  );
}

export function getMovementTargets(db: AppDatabase, fromDivisionId: number, movementType: string): Promise<DivisionTarget[]> {
  return db.all<DivisionTarget>(
    `SELECT pd.id, pd.name, pd.level, pd.max_size
     FROM pyramid_edges pe
     JOIN pyramid_divisions pd ON pd.id = pe.to_division_id
     WHERE pe.from_division_id = ? AND pe.movement_type = ?
     ORDER BY pd.level, pd.name`,
    [fromDivisionId, movementType]
  );
}

export function getSameLevelDivisionsExcluding(db: AppDatabase, divisionId: number): Promise<DivisionTarget[]> {
  return db.all<DivisionTarget>(
    `SELECT id, name, level, max_size FROM pyramid_divisions
     WHERE level = (SELECT level FROM pyramid_divisions WHERE id = ?) AND id != ?
     ORDER BY name`,
    [divisionId, divisionId]
  );
}

export function getDivisionsInTierRangeQuery(db: AppDatabase, tierMin: number, tierMax: number): Promise<DivisionTarget[]> {
  return db.all<DivisionTarget>(
    `SELECT id, name, level, max_size FROM pyramid_divisions
     WHERE level >= ? AND level <= ?
     ORDER BY level, display_order`,
    [tierMin, tierMax]
  );
}

export function getDivisionByIdWithNameAndMaxSize(db: AppDatabase, divisionId: number): Promise<{ name: string; max_size: number } | undefined> {
  return db.get<{ name: string; max_size: number }>(
    "SELECT name, max_size FROM pyramid_divisions WHERE id = ?",
    [divisionId]
  );
}

export function getClubCountInDivisionValue(db: AppDatabase, divisionId: number): Promise<number> {
  return db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM division_assignments WHERE division_id = ?",
    [divisionId]
  ).then(r => r?.count ?? 0);
}

export interface FilledSlot {
  id: number;
  club_id: number;
  source_division_id: number;
  target_division_id: number;
  movement_type: string;
  source_division_name: string;
  target_division_name: string;
}

export function getFilledSlots(db: AppDatabase): Promise<FilledSlot[]> {
  return db.all<FilledSlot>(
    `SELECT ms.id, ms.club_id, ms.source_division_id, ms.target_division_id, ms.movement_type,
            sd.name AS source_division_name, td.name AS target_division_name
     FROM movement_slots ms
     JOIN pyramid_divisions sd ON sd.id = ms.source_division_id
     JOIN pyramid_divisions td ON td.id = ms.target_division_id
     WHERE ms.club_id IS NOT NULL`
  );
}

export function getCurrentSeasonLabel(db: AppDatabase): Promise<{ season_label: string } | undefined> {
  return db.get<{ season_label: string }>("SELECT season_label FROM pyramid_seasons ORDER BY id DESC LIMIT 1");
}
