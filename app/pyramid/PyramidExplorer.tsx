"use client";

import { useMemo, useState } from "react";
import { PyramidGraph } from "@/app/components/pyramid/PyramidGraph";
import type { PyramidExplorerData, LayoutOrientation } from "@/app/components/pyramid/pyramidGraphTypes";

interface Props {
  data: PyramidExplorerData;
}

export function PyramidExplorer({ data }: Props) {
  const [orientation, setOrientation] = useState<LayoutOrientation>("horizontal");
  const [showTopTiers, setShowTopTiers] = useState(true);

  const filteredData = useMemo(() => {
    if (showTopTiers) return data;
    const visibleIds = new Set(data.divisions.filter((d) => d.level >= 5).map((d) => d.id));
    return {
      ...data,
      divisions: data.divisions.filter((d) => visibleIds.has(d.id)),
      edges: data.edges.filter(
        (e) => visibleIds.has(e.from_division_id) && visibleIds.has(e.to_division_id)
      ),
      clubs: data.clubs.filter((c) => visibleIds.has(c.division_id))
    };
  }, [data, showTopTiers]);

  const btnStyle = (active: boolean) => ({
    padding: "6px 14px",
    border: `1px solid ${active ? "#147a4d" : "#dce3e2"}`,
    borderRadius: 7,
    background: active ? "#eef8f1" : "#fff",
    color: active ? "#0e5737" : "#34413e",
    fontSize: 13,
    fontWeight: 650 as const,
    cursor: "pointer"
  });

  return (
    <div style={{ padding: "16px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Pyramid Explorer</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowTopTiers((v) => !v)} style={btnStyle(!showTopTiers)}>
            {showTopTiers ? "Non-league only" : "Show all"}
          </button>
          <button onClick={() => setOrientation("horizontal")} style={btnStyle(orientation === "horizontal")}>
            Horizontal
          </button>
          <button onClick={() => setOrientation("vertical")} style={btnStyle(orientation === "vertical")}>
            Vertical
          </button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--grey-200)",
          borderRadius: 8,
          overflow: "hidden",
          background: "#fbfcfc"
        }}
      >
        <PyramidGraph
          data={filteredData}
          layoutConfig={{ orientation }}
        />
      </div>

      <div style={{ marginTop: 12, fontSize: 13, color: "var(--grey-500)" }}>
        <strong style={{ color: "var(--text)" }}>{filteredData.divisions.length}</strong> divisions,{" "}
        <strong style={{ color: "var(--text)" }}>{filteredData.edges.length}</strong> edges,{" "}
        <strong style={{ color: "var(--text)" }}>{filteredData.clubs.length}</strong> clubs
        &nbsp;&middot;&nbsp; {data.season.label}
      </div>
    </div>
  );
}
