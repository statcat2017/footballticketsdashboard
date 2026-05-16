import type { ExplorerEdge } from "@/lib/db/pyramid-explorer";
import type {
  LayoutConfig,
  LayoutResult,
  PositionedDivision,
  VisualConnection,
  VisualConnectionType,
  PyramidExplorerData
} from "./pyramidGraphTypes";

const DEFAULT_CONFIG: LayoutConfig = {
  orientation: "horizontal",
  columnWidth: 220,
  rowHeight: 56,
  nodeWidth: 190,
  nodeHeight: 42
};

function deriveVisualConnections(
  edges: ExplorerEdge[],
  divisionLevels: Map<number, number>
): VisualConnection[] {
  const pairMap = new Map<string, ExplorerEdge[]>();

  for (const edge of edges) {
    const [a, b] = [edge.from_division_id, edge.to_division_id].sort((x, y) => x - y);
    const key = `${a}:${b}`;
    const existing = pairMap.get(key) ?? [];
    existing.push(edge);
    pairMap.set(key, existing);
  }

  const connections: VisualConnection[] = [];

  for (const [, group] of pairMap) {
    const [idA, idB] = group[0].from_division_id < group[0].to_division_id
      ? [group[0].from_division_id, group[0].to_division_id]
      : [group[0].to_division_id, group[0].from_division_id];

    const levelA = divisionLevels.get(idA) ?? 0;
    const levelB = divisionLevels.get(idB) ?? 0;

    const fromDivisionId = levelA < levelB ? idA : idB;
    const toDivisionId = levelA < levelB ? idB : idA;

    const isReciprocal = group.length >= 2;

    let type: VisualConnectionType;
    if (isReciprocal) {
      type = group.every((e) => e.allocation_type === "fixed")
        ? "fixed"
        : "allocation_dependent";
    } else {
      type = "one_way_warning";
    }

    connections.push({ fromDivisionId, toDivisionId, type, isReciprocal });
  }

  return connections;
}

function computeOrdering(
  divisions: PyramidExplorerData["divisions"],
  edges: ExplorerEdge[]
): Map<number, number> {
  const byLevel = new Map<number, typeof divisions>();
  for (const d of divisions) {
    const list = byLevel.get(d.level) ?? [];
    list.push(d);
    byLevel.set(d.level, list);
  }

  const maxLevel = Math.max(...divisions.map((d) => d.level));
  const order = new Map<number, number>();

  // Anchor: National League North above National League South at level 6
  const nationalNorth = divisions.find((d) => d.code === "national-league-north");
  const nationalSouth = divisions.find((d) => d.code === "national-league-south");
  if (nationalNorth && nationalSouth) {
    order.set(nationalNorth.id, 0);
    order.set(nationalSouth.id, 1);
  }

  // Propagate DOWNWARD (level 7+): sort by average position of divisions you promote INTO
  for (let level = 7; level <= maxLevel; level++) {
    const divs = byLevel.get(level) ?? [];
    if (divs.length <= 1) continue;

    const barycenters = divs.map((d) => {
      const promotionEdges = edges.filter(
        (e) => e.from_division_id === d.id && e.movement_type === "promotion"
      );

      if (promotionEdges.length === 0) {
        return { id: d.id, bary: order.get(d.id) ?? 0 };
      }

      const targetOrders = promotionEdges
        .map((e) => order.get(e.to_division_id))
        .filter((o): o is number => o !== undefined);

      if (targetOrders.length === 0) {
        return { id: d.id, bary: order.get(d.id) ?? 0 };
      }

      const avg = targetOrders.reduce((sum, o) => sum + o, 0) / targetOrders.length;
      return { id: d.id, bary: avg };
    });

    barycenters.sort((a, b) => a.bary - b.bary || a.id - b.id);
    for (let i = 0; i < barycenters.length; i++) {
      order.set(barycenters[i].id, i);
    }
  }

  // Propagate UPWARD (level 5-1): sort by average position of divisions that relegate INTO you
  for (let level = 5; level >= 1; level--) {
    const divs = byLevel.get(level) ?? [];
    if (divs.length <= 1) continue;

    const barycenters = divs.map((d) => {
      const relegationEdges = edges.filter(
        (e) => e.to_division_id === d.id && e.movement_type === "relegation"
      );

      if (relegationEdges.length === 0) {
        return { id: d.id, bary: order.get(d.id) ?? 0 };
      }

      const sourceOrders = relegationEdges
        .map((e) => order.get(e.from_division_id))
        .filter((o): o is number => o !== undefined);

      if (sourceOrders.length === 0) {
        return { id: d.id, bary: order.get(d.id) ?? 0 };
      }

      const avg = sourceOrders.reduce((sum, o) => sum + o, 0) / sourceOrders.length;
      return { id: d.id, bary: avg };
    });

    barycenters.sort((a, b) => a.bary - b.bary || a.id - b.id);
    for (let i = 0; i < barycenters.length; i++) {
      order.set(barycenters[i].id, i);
    }
  }

  return order;
}

export function computeLayout(
  data: PyramidExplorerData,
  partialConfig?: Partial<LayoutConfig>
): LayoutResult {
  const config: LayoutConfig = { ...DEFAULT_CONFIG, ...partialConfig };

  if (data.divisions.length === 0) {
    return { divisions: [], visualConnections: [], config };
  }

  const divisionLevels = new Map(data.divisions.map((d) => [d.id, d.level]));
  const optimizedOrder = computeOrdering(data.divisions, data.edges);

  const byLevel = new Map<number, { d: PyramidExplorerData["divisions"][number]; row: number }[]>();
  for (const d of data.divisions) {
    const row = optimizedOrder.get(d.id) ?? 0;
    const list = byLevel.get(d.level) ?? [];
    list.push({ d, row });
    byLevel.set(d.level, list);
  }

  for (const [, divs] of byLevel) {
    divs.sort((a, b) => a.row - b.row);
  }

  const sortedLevels = [...byLevel.entries()].sort(([a], [b]) => a - b);
  const positionedDivisions: PositionedDivision[] = [];
  const isHorizontal = config.orientation === "horizontal";

  for (const [level, divs] of sortedLevels) {
    const n = divs.length;
    if (isHorizontal) {
      const x = (level - 1) * config.columnWidth;
      const startY = -(n - 1) * config.rowHeight / 2;
      for (let i = 0; i < n; i++) {
        positionedDivisions.push({ ...divs[i].d, x, y: startY + i * config.rowHeight });
      }
    } else {
      const y = (level - 1) * config.rowHeight;
      const startX = -(n - 1) * config.columnWidth / 2;
      for (let i = 0; i < n; i++) {
        positionedDivisions.push({ ...divs[i].d, x: startX + i * config.columnWidth, y });
      }
    }
  }

  const visualConnections = deriveVisualConnections(data.edges, divisionLevels);

  return { divisions: positionedDivisions, visualConnections, config };
}
