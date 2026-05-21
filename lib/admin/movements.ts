import type { AppDatabase, SqlWrite } from "@/lib/db/adapter";
import { buildAdminAuditLogWrite } from "@/lib/admin/audit";

export type MovementType = "promotion" | "relegation" | "migration";

export interface MovementSlotRow {
  id: number;
  source_division_id: number;
  target_division_id: number;
  movement_type: MovementType;
  slot_index: number;
  club_id: number | null;
  club_name: string | null;
  source_division_name: string;
  source_division_level: number;
  target_division_name: string;
  target_division_level: number;
  notes: string | null;
  actor: string | null;
  created_at: string;
}

export interface SlotItem {
  id: number;
  slotIndex: number;
  clubId: number | null;
  clubName: string | null;
  notes: string | null;
}

export interface SlotGroup {
  sourceDivisionId: number;
  sourceDivisionName: string;
  sourceDivisionLevel: number;
  targetDivisionId: number;
  targetDivisionName: string;
  targetDivisionLevel: number;
  movementType: MovementType;
  totalSlots: number;
  filledSlots: number;
  slots: SlotItem[];
}

export interface MovementViewData {
  tierMin: number;
  tierMax: number;
  slotGroups: SlotGroup[];
  totalSlots: number;
  totalFilled: number;
  affectedDivisions: number;
}

export interface SlotValidationResult {
  errors: string[];
  warnings: string[];
}

export interface DivisionOption {
  id: number;
  name: string;
  level: number;
  max_size: number;
}

export interface ClubOption {
  id: number;
  name: string;
}

interface SlotGroupKey {
  source_division_id: number;
  target_division_id: number;
  movement_type: MovementType;
}

function makeSlotGroupKey(k: SlotGroupKey): string {
  return `${k.source_division_id}:${k.target_division_id}:${k.movement_type}`;
}

function getSlotGroupClubsQuery(): string {
  return `SELECT
      ms.id,
      ms.source_division_id,
      ms.target_division_id,
      ms.movement_type,
      ms.slot_index,
      ms.club_id,
      c.name AS club_name,
      sd.name AS source_division_name,
      sd.level AS source_division_level,
      td.name AS target_division_name,
      td.level AS target_division_level,
      ms.notes,
      ms.actor,
      ms.created_at
    FROM movement_slots ms
    JOIN pyramid_divisions sd ON sd.id = ms.source_division_id
    JOIN pyramid_divisions td ON td.id = ms.target_division_id
    LEFT JOIN clubs c ON c.id = ms.club_id`;
}

export async function getMovementViewData(
  db: AppDatabase,
  tierMin: number,
  tierMax: number
): Promise<MovementViewData> {
  const rows = await db.all<MovementSlotRow>(
    `${getSlotGroupClubsQuery()}
     WHERE sd.level >= ? AND sd.level <= ?
     ORDER BY sd.level, sd.display_order, td.level, td.display_order, ms.slot_index`,
    [tierMin, tierMax]
  );

  const groupsMap = new Map<string, {
    key: SlotGroupKey;
    sourceName: string;
    sourceLevel: number;
    targetName: string;
    targetLevel: number;
    slots: SlotItem[];
  }>();

  for (const row of rows) {
    const key = makeSlotGroupKey(row);
    let group = groupsMap.get(key);
    if (!group) {
      group = {
        key: {
          source_division_id: row.source_division_id,
          target_division_id: row.target_division_id,
          movement_type: row.movement_type,
        },
        sourceName: row.source_division_name,
        sourceLevel: row.source_division_level,
        targetName: row.target_division_name,
        targetLevel: row.target_division_level,
        slots: [],
      };
      groupsMap.set(key, group);
    }
    group.slots.push({
      id: row.id,
      slotIndex: row.slot_index,
      clubId: row.club_id,
      clubName: row.club_name,
      notes: row.notes,
    });
  }

  const slotGroups: SlotGroup[] = [];
  for (const group of groupsMap.values()) {
    const filled = group.slots.filter((s) => s.clubId !== null).length;
    slotGroups.push({
      sourceDivisionId: group.key.source_division_id,
      sourceDivisionName: group.sourceName,
      sourceDivisionLevel: group.sourceLevel,
      targetDivisionId: group.key.target_division_id,
      targetDivisionName: group.targetName,
      targetDivisionLevel: group.targetLevel,
      movementType: group.key.movement_type,
      totalSlots: group.slots.length,
      filledSlots: filled,
      slots: group.slots,
    });
  }

  const totalSlots = slotGroups.reduce((s, g) => s + g.totalSlots, 0);
  const totalFilled = slotGroups.reduce((s, g) => s + g.filledSlots, 0);
  const divisionIds = new Set<number>();
  for (const g of slotGroups) {
    divisionIds.add(g.sourceDivisionId);
    divisionIds.add(g.targetDivisionId);
  }

  return {
    tierMin,
    tierMax,
    slotGroups,
    totalSlots,
    totalFilled,
    affectedDivisions: divisionIds.size,
  };
}

export async function createSlots(
  db: AppDatabase,
  sourceDivisionId: number,
  targetDivisionId: number,
  movementType: MovementType,
  count: number,
  actor: string
): Promise<{ created: number; skipped: number }> {
  const source = await db.get<{ id: number; name: string; level: number }>(
    "SELECT id, name, level FROM pyramid_divisions WHERE id = ?",
    [sourceDivisionId]
  );
  if (!source) throw new Error(`Source division ${sourceDivisionId} not found.`);

  const target = await db.get<{ id: number; name: string; level: number; max_size: number }>(
    "SELECT id, name, level, max_size FROM pyramid_divisions WHERE id = ?",
    [targetDivisionId]
  );
  if (!target) throw new Error(`Target division ${targetDivisionId} not found.`);

  if (sourceDivisionId === targetDivisionId) {
    throw new Error("Source and target divisions must be different.");
  }

  const existingSlots = await db.all<{ slot_index: number }>(
    `SELECT slot_index FROM movement_slots
     WHERE source_division_id = ? AND target_division_id = ? AND movement_type = ?`,
    [sourceDivisionId, targetDivisionId, movementType]
  );
  const existingIndices = new Set(existingSlots.map((s) => s.slot_index));

  const now = new Date().toISOString();
  const statements: SqlWrite[] = [];
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < count; i++) {
    if (existingIndices.has(i)) {
      skipped++;
      continue;
    }
    statements.push({
      sql: `INSERT INTO movement_slots (source_division_id, target_division_id, movement_type, slot_index, actor, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [sourceDivisionId, targetDivisionId, movementType, i, actor, now],
    });
    created++;
  }

  if (statements.length > 0) {
    await db.writeBatch(statements);
  }

  return { created, skipped };
}

export async function validateSlotFill(
  db: AppDatabase,
  slotId: number,
  clubId: number
): Promise<SlotValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const slot = await db.get<{
    id: number;
    source_division_id: number;
    target_division_id: number;
    movement_type: MovementType;
    club_id: number | null;
  }>("SELECT id, source_division_id, target_division_id, movement_type, club_id FROM movement_slots WHERE id = ?", [slotId]);

  if (!slot) {
    errors.push("Slot not found.");
    return { errors, warnings };
  }

  if (slot.club_id !== null) {
    errors.push("Slot is already filled.");
    return { errors, warnings };
  }

  const club = await db.get<{ id: number; name: string }>(
    "SELECT id, name FROM clubs WHERE id = ?",
    [clubId]
  );
  if (!club) {
    errors.push(`Club ${clubId} not found.`);
    return { errors, warnings };
  }

  const clubDivision = await db.get<{ division_id: number }>(
    "SELECT division_id FROM division_assignments WHERE club_id = ?",
    [clubId]
  );
  if (!clubDivision || clubDivision.division_id !== slot.source_division_id) {
    errors.push("Club is not assigned to the source division for this slot.");
  }

  const existingFill = await db.get<{ id: number }>(
    `SELECT id FROM movement_slots WHERE club_id = ? AND id != ? AND club_id IS NOT NULL`,
    [clubId, slotId]
  );
  if (existingFill) {
    errors.push("Club is already assigned to another filled slot. Unfill that slot first.");
  }

  const edge = await db.get<{ id: number }>(
    `SELECT id FROM pyramid_edges
     WHERE from_division_id = ? AND to_division_id = ? AND movement_type = ?`,
    [slot.source_division_id, slot.target_division_id, slot.movement_type]
  );
  if (!edge) {
    warnings.push("No pyramid edge exists between these divisions.");
  }

  const targetDivision = await db.get<{ max_size: number }>(
    "SELECT max_size FROM pyramid_divisions WHERE id = ?",
    [slot.target_division_id]
  );
  if (targetDivision) {
    const targetCount = await db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM division_assignments WHERE division_id = ?",
      [slot.target_division_id]
    );
    if (targetCount && targetCount.count >= targetDivision.max_size) {
      warnings.push(`Target division is at capacity (${targetDivision.max_size} clubs).`);
    }
  }

  return { errors, warnings };
}

export async function fillSlot(
  db: AppDatabase,
  slotId: number,
  clubId: number,
  actor: string
): Promise<{ warnings: string[] }> {
  const slot = await db.get<{
    id: number;
    source_division_id: number;
    target_division_id: number;
    movement_type: MovementType;
    club_id: number | null;
  }>("SELECT id, source_division_id, target_division_id, movement_type, club_id FROM movement_slots WHERE id = ?", [slotId]);

  if (!slot) throw new Error("Slot not found.");
  if (slot.club_id !== null) throw new Error("Slot is already filled.");

  const club = await db.get<{ id: number; name: string }>(
    "SELECT id, name FROM clubs WHERE id = ?",
    [clubId]
  );
  if (!club) throw new Error(`Club ${clubId} not found.`);

  const clubDivision = await db.get<{ division_id: number }>(
    "SELECT division_id FROM division_assignments WHERE club_id = ?",
    [clubId]
  );
  if (!clubDivision || clubDivision.division_id !== slot.source_division_id) {
    throw new Error("Club is not assigned to the source division for this slot.");
  }

  const existingFill = await db.get<{ id: number }>(
    `SELECT id FROM movement_slots WHERE club_id = ? AND id != ?`,
    [clubId, slotId]
  );
  if (existingFill) {
    throw new Error("Club is already assigned to another filled slot. Unfill that slot first.");
  }

  const warnings: string[] = [];
  const edge = await db.get<{ id: number }>(
    `SELECT id FROM pyramid_edges
     WHERE from_division_id = ? AND to_division_id = ? AND movement_type = ?`,
    [slot.source_division_id, slot.target_division_id, slot.movement_type]
  );
  if (!edge) {
    warnings.push("No pyramid edge exists between these divisions.");
  }

  const targetDivision = await db.get<{ max_size: number; name: string }>(
    "SELECT name, max_size FROM pyramid_divisions WHERE id = ?",
    [slot.target_division_id]
  );
  if (targetDivision) {
    const targetCount = await db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM division_assignments WHERE division_id = ?",
      [slot.target_division_id]
    );
    if (targetCount && targetCount.count >= targetDivision.max_size) {
      warnings.push(`Target division "${targetDivision.name}" is at capacity (${targetDivision.max_size} clubs).`);
    }
  }

  const statements: SqlWrite[] = [
    {
      sql: "UPDATE movement_slots SET club_id = ?, actor = ?, notes = COALESCE(notes, '') WHERE id = ?",
      params: [clubId, actor, slotId],
    },
    buildAdminAuditLogWrite({
      action: "movement_slot_fill",
      entityType: "movement_slot",
      entityId: slotId,
      actor,
      before: { club_id: null },
      after: { club_id: clubId },
    }),
  ];

  await db.writeBatch(statements);
  return { warnings };
}

export async function unfillSlot(
  db: AppDatabase,
  slotId: number,
  actor: string
): Promise<void> {
  const slot = await db.get<{ id: number; club_id: number | null }>(
    "SELECT id, club_id FROM movement_slots WHERE id = ?",
    [slotId]
  );
  if (!slot) throw new Error("Slot not found.");
  if (slot.club_id === null) throw new Error("Slot is not filled.");

  const statements: SqlWrite[] = [
    {
      sql: "UPDATE movement_slots SET club_id = NULL, actor = ?, notes = COALESCE(notes, '') WHERE id = ?",
      params: [actor, slotId],
    },
    buildAdminAuditLogWrite({
      action: "movement_slot_unfill",
      entityType: "movement_slot",
      entityId: slotId,
      actor,
      before: { club_id: slot.club_id },
      after: { club_id: null },
    }),
  ];

  await db.writeBatch(statements);
}

export async function deleteSlot(
  db: AppDatabase,
  slotId: number,
  actor: string
): Promise<void> {
  const slot = await db.get<{ id: number; club_id: number | null }>(
    "SELECT id, club_id FROM movement_slots WHERE id = ?",
    [slotId]
  );
  if (!slot) throw new Error("Slot not found.");
  if (slot.club_id !== null) throw new Error("Cannot delete a filled slot. Unfill it first.");

  const statements: SqlWrite[] = [
    {
      sql: "DELETE FROM movement_slots WHERE id = ?",
      params: [slotId],
    },
    buildAdminAuditLogWrite({
      action: "movement_slot_delete",
      entityType: "movement_slot",
      entityId: slotId,
      actor,
      before: { club_id: null },
      after: null,
    }),
  ];

  await db.writeBatch(statements);
}

export async function applyAllFilledSlots(db: AppDatabase, actor: string): Promise<number> {
  const filledSlots = await db.all<{
    id: number;
    club_id: number;
    source_division_id: number;
    target_division_id: number;
    movement_type: MovementType;
    source_division_name: string;
    target_division_name: string;
  }>(
    `SELECT ms.id, ms.club_id, ms.source_division_id, ms.target_division_id, ms.movement_type,
            sd.name AS source_division_name, td.name AS target_division_name
     FROM movement_slots ms
     JOIN pyramid_divisions sd ON sd.id = ms.source_division_id
     JOIN pyramid_divisions td ON td.id = ms.target_division_id
     WHERE ms.club_id IS NOT NULL`
  );

  if (filledSlots.length === 0) {
    return 0;
  }

  const statements: SqlWrite[] = [];

  for (const slot of filledSlots) {
    const clubDivision = await db.get<{ division_id: number }>(
      "SELECT division_id FROM division_assignments WHERE club_id = ?",
      [slot.club_id]
    );
    if (!clubDivision || clubDivision.division_id !== slot.source_division_id) {
      throw new Error(
        `Club ${slot.club_id} is no longer in the source division "${slot.source_division_name}" for movement slot ${slot.id}.`
      );
    }

    const existingFill = await db.get<{ id: number }>(
      `SELECT id FROM movement_slots WHERE club_id = ? AND id != ? AND club_id IS NOT NULL`,
      [slot.club_id, slot.id]
    );
    if (existingFill) {
      throw new Error(
        `Club ${slot.club_id} is double-booked across movement slots ${slot.id} and ${existingFill.id}.`
      );
    }

    statements.push({
      sql: "UPDATE division_assignments SET division_id = ?, admin_updated_at = ? WHERE club_id = ?",
      params: [slot.target_division_id, new Date().toISOString(), slot.club_id],
    });

    statements.push(buildAdminAuditLogWrite({
      action: "movement_slot_apply",
      entityType: "club_movement",
      entityId: slot.club_id,
      actor,
      before: { club_id: slot.club_id, from_division_id: slot.source_division_id, movement_type: slot.movement_type },
      after: { club_id: slot.club_id, to_division_id: slot.target_division_id, movement_type: slot.movement_type },
    }));
  }

  statements.push({
    sql: "DELETE FROM movement_slots WHERE club_id IS NOT NULL",
    params: [],
  });

  await db.writeBatch(statements);
  return filledSlots.length;
}

export async function getDivisionsInTierRange(
  db: AppDatabase,
  tierMin: number,
  tierMax: number
): Promise<DivisionOption[]> {
  return db.all<DivisionOption>(
    `SELECT id, name, level, max_size FROM pyramid_divisions
     WHERE level >= ? AND level <= ?
     ORDER BY level, display_order`,
    [tierMin, tierMax]
  );
}

export async function getClubsInDivision(
  db: AppDatabase,
  divisionId: number
): Promise<ClubOption[]> {
  return db.all<ClubOption>(
    `SELECT c.id, c.name
     FROM division_assignments da
     JOIN clubs c ON c.id = da.club_id
     WHERE da.division_id = ?
     ORDER BY c.name`,
    [divisionId]
  );
}

export async function getConnectedTargets(
  db: AppDatabase,
  sourceDivisionId: number,
  movementType: MovementType
): Promise<DivisionOption[]> {
  return db.all<DivisionOption>(
    `SELECT pd.id, pd.name, pd.level, pd.max_size
     FROM pyramid_edges pe
     JOIN pyramid_divisions pd ON pd.id = pe.to_division_id
     WHERE pe.from_division_id = ? AND pe.movement_type = ?
     ORDER BY pd.level, pd.name`,
    [sourceDivisionId, movementType]
  );
}
