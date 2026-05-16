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

export function computeLayout(
  data: PyramidExplorerData,
  partialConfig?: Partial<LayoutConfig>
): LayoutResult {
  const config: LayoutConfig = { ...DEFAULT_CONFIG, ...partialConfig };

  const divisionLevels = new Map(data.divisions.map((d) => [d.id, d.level]));

  const positionedDivisions: PositionedDivision[] = data.divisions.map((d) => {
    const order = d.display_order ?? 1;
    let x: number;
    let y: number;
    if (config.orientation === "horizontal") {
      x = (d.level - 1) * config.columnWidth;
      y = (order - 1) * config.rowHeight;
    } else {
      x = (order - 1) * config.columnWidth;
      y = (d.level - 1) * config.rowHeight;
    }
    return { ...d, x, y };
  });

  const visualConnections = deriveVisualConnections(data.edges, divisionLevels);

  return { divisions: positionedDivisions, visualConnections, config };
}
