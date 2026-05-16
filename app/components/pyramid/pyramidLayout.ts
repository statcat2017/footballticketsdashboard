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

function computeCrossingMinimizingOrder(
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

  // Build adjacency: division -> connected division ids
  const adjacency = new Map<number, Set<number>>();
  for (const e of edges) {
    const from = e.from_division_id;
    const to = e.to_division_id;
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from)!.add(to);
    adjacency.get(to)!.add(from);
  }

  // Initial order: by display_order within each level
  const order = new Map<number, number>();
  for (const [, divs] of byLevel) {
    const sorted = [...divs].sort((a, b) => {
      const ao = a.display_order ?? 1;
      const bo = b.display_order ?? 1;
      return ao - bo;
    });
    for (let i = 0; i < sorted.length; i++) {
      order.set(sorted[i].id, i);
    }
  }

  // Barycenter iterations
  for (let iter = 0; iter < 8; iter++) {
    // Sweep top-down (level 1 to max)
    for (let level = 2; level <= maxLevel; level++) {
      const divs = byLevel.get(level) ?? [];
      if (divs.length <= 1) continue;

      const prevLevel = level - 1;
      const prevOrder = new Map<number, number>();
      const prevDivs = byLevel.get(prevLevel) ?? [];
      for (let i = 0; i < prevDivs.length; i++) {
        prevOrder.set(prevDivs[i].id, i);
      }

      const barycenters = divs.map((d) => {
        const neighbors = adjacency.get(d.id) ?? new Set<number>();
        const connected = [...neighbors].filter((n) => prevOrder.has(n));
        if (connected.length === 0) return { id: d.id, bary: order.get(d.id) ?? 0 };
        const avg = connected.reduce((sum, n) => sum + (prevOrder.get(n) ?? 0), 0) / connected.length;
        return { id: d.id, bary: avg };
      });

      barycenters.sort((a, b) => a.bary - b.bary);
      for (let i = 0; i < barycenters.length; i++) {
        order.set(barycenters[i].id, i);
      }
    }

    // Sweep bottom-up (max to 1)
    for (let level = maxLevel - 1; level >= 1; level--) {
      const divs = byLevel.get(level) ?? [];
      if (divs.length <= 1) continue;

      const nextLevel = level + 1;
      const nextOrder = new Map<number, number>();
      const nextDivs = byLevel.get(nextLevel) ?? [];
      for (let i = 0; i < nextDivs.length; i++) {
        nextOrder.set(nextDivs[i].id, i);
      }

      const barycenters = divs.map((d) => {
        const neighbors = adjacency.get(d.id) ?? new Set<number>();
        const connected = [...neighbors].filter((n) => nextOrder.has(n));
        if (connected.length === 0) return { id: d.id, bary: order.get(d.id) ?? 0 };
        const avg = connected.reduce((sum, n) => sum + (nextOrder.get(n) ?? 0), 0) / connected.length;
        return { id: d.id, bary: avg };
      });

      barycenters.sort((a, b) => a.bary - b.bary);
      for (let i = 0; i < barycenters.length; i++) {
        order.set(barycenters[i].id, i);
      }
    }
  }

  return order;
}

export function computeLayout(
  data: PyramidExplorerData,
  partialConfig?: Partial<LayoutConfig>
): LayoutResult {
  const config: LayoutConfig = { ...DEFAULT_CONFIG, ...partialConfig };

  const divisionLevels = new Map(data.divisions.map((d) => [d.id, d.level]));

  const optimizedOrder = computeCrossingMinimizingOrder(data.divisions, data.edges);

  const positionedDivisions: PositionedDivision[] = data.divisions.map((d) => {
    const order = optimizedOrder.get(d.id) ?? 0;
    let x: number;
    let y: number;
    if (config.orientation === "horizontal") {
      x = (d.level - 1) * config.columnWidth;
      y = order * config.rowHeight;
    } else {
      x = order * config.columnWidth;
      y = (d.level - 1) * config.rowHeight;
    }
    return { ...d, x, y };
  });

  const visualConnections = deriveVisualConnections(data.edges, divisionLevels);

  return { divisions: positionedDivisions, visualConnections, config };
}
