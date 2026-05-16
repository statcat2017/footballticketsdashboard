"use client";

import { useMemo, useState } from "react";
import { computeLayout } from "./pyramidLayout";
import type {
  LayoutConfig,
  LayoutOrientation,
  PositionedDivision,
  VisualConnection,
  PyramidExplorerData
} from "./pyramidGraphTypes";

interface PyramidGraphProps {
  data: PyramidExplorerData;
  layoutConfig?: Partial<LayoutConfig>;
}

type HoverTarget = { type: "division"; id: number } | { type: "connection"; from: number; to: number } | null;

export function PyramidGraph({
  data,
  layoutConfig
}: PyramidGraphProps) {
  const [hovered, setHovered] = useState<HoverTarget>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);

  const layout = useMemo(() => computeLayout(data, layoutConfig), [data, layoutConfig]);
  const divisions = layout.divisions;
  const connections = layout.visualConnections;
  const cfg = layout.config;

  if (divisions.length === 0) {
    return (
      <div role="status" style={{ borderRadius: 8, border: "1px dashed var(--grey-300)", padding: 24, fontSize: 14, color: "var(--grey-500)" }}>
        No pyramid data available.
      </div>
    );
  }

  const minX = Math.min(...divisions.map((d) => d.x));
  const minY = Math.min(...divisions.map((d) => d.y));
  const maxX = Math.max(...divisions.map((d) => d.x));
  const maxY = Math.max(...divisions.map((d) => d.y));
  const pad = 20;
  const viewBoxX = minX - pad;
  const viewBoxY = minY - pad;
  const svgWidth = (maxX - minX) + cfg.nodeWidth + pad * 2;
  const svgHeight = (maxY - minY) + cfg.nodeHeight + pad * 2;

  return (
    <svg
      viewBox={`${viewBoxX} ${viewBoxY} ${svgWidth} ${svgHeight}`}
      role="img"
      aria-label="English football pyramid"
      style={{ width: "100%", height: "auto", maxHeight: "90vh", overflow: "visible" }}
    >
      <defs>
        <marker
          id="arrow-warning"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#a76800" />
        </marker>
      </defs>

      {connections.map((conn) => {
        const fromDiv = divisions.find((d) => d.id === conn.fromDivisionId);
        const toDiv = divisions.find((d) => d.id === conn.toDivisionId);
        if (!fromDiv || !toDiv) return null;

        const isConnectedToSelected =
          selectedDivisionId != null &&
          (conn.fromDivisionId === selectedDivisionId ||
            conn.toDivisionId === selectedDivisionId);

        const isConnHovered =
          hovered?.type === "connection" &&
          hovered.from === conn.fromDivisionId &&
          hovered.to === conn.toDivisionId;

        const opacity = isConnectedToSelected || isConnHovered ? 0.8 : 0.25;
        const strokeWidth = isConnectedToSelected || isConnHovered ? 2.5 : 1;

        return (
          <ConnectionLine
            key={`conn-${conn.fromDivisionId}-${conn.toDivisionId}`}
            connection={conn}
            fromDiv={fromDiv}
            toDiv={toDiv}
            nodeWidth={cfg.nodeWidth}
            nodeHeight={cfg.nodeHeight}
            orientation={cfg.orientation}
            opacity={opacity}
            strokeWidth={strokeWidth}
            onMouseEnter={() =>
              setHovered({ type: "connection", from: conn.fromDivisionId, to: conn.toDivisionId })
            }
            onMouseLeave={() => setHovered(null)}
          />
        );
      })}

      {divisions.map((div) => {
        const isSelected = div.id === selectedDivisionId;
        let connectionHighlight = false;
        if (selectedDivisionId != null || (hovered?.type === "connection")) {
          const connId = hovered?.type === "connection"
            ? [hovered.from, hovered.to]
            : [selectedDivisionId!];
          connectionHighlight = connections.some(
            (c) =>
              (c.fromDivisionId === div.id || c.toDivisionId === div.id) &&
              connId.includes(c.fromDivisionId === div.id ? c.toDivisionId : c.fromDivisionId)
          );
        }

        return (
          <DivisionNode
            key={div.id}
            division={div}
            nodeWidth={cfg.nodeWidth}
            nodeHeight={cfg.nodeHeight}
            isSelected={isSelected}
            dimmed={selectedDivisionId != null && !isSelected && !connectionHighlight}
            onMouseEnter={() => setHovered({ type: "division", id: div.id })}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setSelectedDivisionId(div.id === selectedDivisionId ? null : div.id)}
          />
        );
      })}
    </svg>
  );
}

export function edgePath(
  fromDiv: PositionedDivision,
  toDiv: PositionedDivision,
  nodeWidth: number,
  nodeHeight: number,
  orientation: LayoutOrientation
): string {
  if (orientation === "vertical") {
    const x1 = fromDiv.x + nodeWidth / 2;
    const y1 = fromDiv.y + nodeHeight;
    const x2 = toDiv.x + nodeWidth / 2;
    const y2 = toDiv.y;
    const dy = Math.abs(y2 - y1) * 0.4;
    return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
  }

  const x1 = fromDiv.x + nodeWidth;
  const y1 = fromDiv.y + nodeHeight / 2;
  const x2 = toDiv.x;
  const y2 = toDiv.y + nodeHeight / 2;
  const dx = Math.abs(x2 - x1) * 0.4;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

interface ConnectionLineProps {
  connection: VisualConnection;
  fromDiv: PositionedDivision;
  toDiv: PositionedDivision;
  nodeWidth: number;
  nodeHeight: number;
  orientation: LayoutOrientation;
  opacity: number;
  strokeWidth: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function ConnectionLine({
  connection,
  fromDiv,
  toDiv,
  nodeWidth,
  nodeHeight,
  orientation,
  opacity,
  strokeWidth,
  onMouseEnter,
  onMouseLeave
}: ConnectionLineProps) {
  const path = edgePath(fromDiv, toDiv, nodeWidth, nodeHeight, orientation);

  const common = {
    d: path,
    fill: "none",
    onMouseEnter,
    onMouseLeave
  } as const;

  if (connection.type === "fixed") {
    return (
      <path
        {...common}
        stroke="#17221f"
        strokeWidth={strokeWidth}
        strokeOpacity={opacity}
        style={{ cursor: "pointer" }}
      />
    );
  }

  if (connection.type === "allocation_dependent") {
    return (
      <path
        {...common}
        stroke="#17221f"
        strokeWidth={strokeWidth}
        strokeOpacity={opacity}
        strokeDasharray="6 4"
        style={{ cursor: "pointer" }}
      />
    );
  }

  return (
    <path
      {...common}
      stroke="#a76800"
      strokeWidth={strokeWidth}
      strokeOpacity={opacity}
      strokeDasharray="4 3"
      markerEnd="url(#arrow-warning)"
      style={{ cursor: "pointer" }}
    />
  );
}

interface DivisionNodeProps {
  division: PositionedDivision;
  nodeWidth: number;
  nodeHeight: number;
  isSelected: boolean;
  dimmed: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

function wrapDivisionName(name: string, maxChars: number = 22, maxLines: number = 3): string[] {
  if (name.length <= maxChars) return [name];
  const words = name.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    let last = lines[maxLines - 1];
    last = last.slice(0, -1) + "…";
    lines[maxLines - 1] = last;
    lines.splice(maxLines);
  }
  return lines;
}

function DivisionNode({
  division,
  nodeWidth,
  nodeHeight,
  isSelected,
  dimmed,
  onMouseEnter,
  onMouseLeave,
  onClick
}: DivisionNodeProps) {
  const rx = 6;
  const opacity = dimmed ? 0.35 : 1;
  const lines = wrapDivisionName(division.name);
  const n = lines.length;
  const lineHeight = 12;
  const centerY = division.y + nodeHeight / 2;
  const isMultiLine = n > 1;

  return (
    <g
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{ cursor: "pointer" }}
      tabIndex={0}
      role="button"
      aria-label={`${division.name}, level ${division.level}`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
    >
      <rect
        x={division.x}
        y={division.y}
        width={nodeWidth}
        height={nodeHeight}
        rx={rx}
        fill={isSelected ? "#eef8f1" : "#ffffff"}
        stroke={isSelected ? "#147a4d" : "#dce3e2"}
        strokeWidth={isSelected ? 2 : 1}
        opacity={opacity}
      />
      {isMultiLine ? (
        <text
          fill={isSelected ? "#0e5737" : "#17221f"}
          fontSize={11}
          fontWeight={isSelected ? 700 : 500}
          fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
          opacity={opacity}
        >
          {lines.map((line, i) => (
            <tspan key={i} x={division.x + 10} y={centerY - (n - 1) * lineHeight / 2 + i * lineHeight}>
              {line}
            </tspan>
          ))}
        </text>
      ) : (
        <text
          x={division.x + 10}
          y={centerY}
          dy="0.35em"
          fill={isSelected ? "#0e5737" : "#17221f"}
          fontSize={11}
          fontWeight={isSelected ? 700 : 500}
          fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
          opacity={opacity}
        >
          {division.name}
        </text>
      )}
      <text
        x={division.x + nodeWidth - 10}
        y={centerY}
        dy="0.35em"
        textAnchor="end"
        fill="#6f7e7a"
        fontSize={10}
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        opacity={opacity}
      >
        L{division.level}
      </text>
    </g>
  );
}
