import type {
  ExplorerDivision,
  ExplorerEdge,
  PyramidExplorerData
} from "@/lib/db/pyramid-explorer";

export type LayoutOrientation = "horizontal" | "vertical";

export interface LayoutConfig {
  orientation: LayoutOrientation;
  columnWidth: number;
  rowHeight: number;
  nodeWidth: number;
  nodeHeight: number;
}

export interface PositionedDivision extends ExplorerDivision {
  x: number;
  y: number;
}

export type VisualConnectionType = "fixed" | "allocation_dependent" | "one_way_warning";

export interface VisualConnection {
  fromDivisionId: number;
  toDivisionId: number;
  type: VisualConnectionType;
  isReciprocal: boolean;
}

export interface LayoutResult {
  divisions: PositionedDivision[];
  visualConnections: VisualConnection[];
  config: LayoutConfig;
}

export type { ExplorerDivision, ExplorerEdge, PyramidExplorerData };
