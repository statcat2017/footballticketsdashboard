"use client";

import { useState } from "react";
import { PyramidGraph } from "@/app/components/pyramid/PyramidGraph";
import type { PyramidExplorerData, LayoutOrientation } from "@/app/components/pyramid/pyramidGraphTypes";

interface Props {
  data: PyramidExplorerData;
}

export function PyramidExplorer({ data }: Props) {
  const [orientation, setOrientation] = useState<LayoutOrientation>("horizontal");

  return (
    <div style={{ padding: "16px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Pyramid Explorer</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setOrientation("horizontal")}
            style={{
              padding: "6px 14px",
              border: `1px solid ${orientation === "horizontal" ? "#147a4d" : "#dce3e2"}`,
              borderRadius: 7,
              background: orientation === "horizontal" ? "#eef8f1" : "#fff",
              color: orientation === "horizontal" ? "#0e5737" : "#34413e",
              fontSize: 13,
              fontWeight: 650,
              cursor: "pointer"
            }}
          >
            Horizontal
          </button>
          <button
            onClick={() => setOrientation("vertical")}
            style={{
              padding: "6px 14px",
              border: `1px solid ${orientation === "vertical" ? "#147a4d" : "#dce3e2"}`,
              borderRadius: 7,
              background: orientation === "vertical" ? "#eef8f1" : "#fff",
              color: orientation === "vertical" ? "#0e5737" : "#34413e",
              fontSize: 13,
              fontWeight: 650,
              cursor: "pointer"
            }}
          >
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
          data={data}
          layoutConfig={{ orientation }}
        />
      </div>

      <div style={{ marginTop: 12, fontSize: 13, color: "var(--grey-500)" }}>
        <strong style={{ color: "var(--text)" }}>{data.divisions.length}</strong> divisions,{" "}
        <strong style={{ color: "var(--text)" }}>{data.edges.length}</strong> edges,{" "}
        <strong style={{ color: "var(--text)" }}>{data.clubs.length}</strong> clubs
        &nbsp;&middot;&nbsp; {data.season.label}
      </div>
    </div>
  );
}
