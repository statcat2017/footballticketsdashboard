"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const MapEditorWrapper = dynamic(
  () => import("@/app/admin/venues/_components/MapEditorWrapper").then((m) => ({ default: m.MapEditorWrapper })),
  { ssr: false, loading: () => <p style={{ fontSize: "12px", color: "#6f7e7a" }}>Loading map editor…</p> },
);

export function LazyMapEditor(props: {
  isApproximate: boolean;
  latInputId: string;
  lngInputId: string;
  approxInputId: string;
  precisionInputId: string;
  mode: "edit" | "create";
  venueId?: number;
  postcodeName?: string;
}) {
  const [visible, setVisible] = useState(false);

  if (!visible) {
    return (
      <button type="button" onClick={() => setVisible(true)} style={{
        border: "1px solid #dce3e2", borderRadius: "4px",
        background: "#fff", padding: "0.3rem 0.6rem",
        fontSize: "12px", fontWeight: 600, cursor: "pointer", color: "#34413e",
      }}>
        Use map to set coordinates
      </button>
    );
  }

  return <MapEditorWrapper {...props} />;
}
