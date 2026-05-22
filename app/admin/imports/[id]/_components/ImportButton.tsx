"use client";

import { useActionState } from "react";
import { importRowAction } from "../actions";

export function ImportButton({ batchId, rowId }: { batchId: number; rowId: number }) {
  const [state, action, pending] = useActionState(importRowAction.bind(null, batchId, rowId), null);

  return (
    <form action={action} style={{ display: "inline" }}>
      {state?.error && <p style={{ color: "#a53a2d", fontSize: "12px", margin: "0 0 0.25rem" }}>{state.error}</p>}
      {state?.success && <p style={{ color: "#0e5737", fontSize: "12px", margin: "0 0 0.25rem" }}>{state.success}</p>}
      <button type="submit" disabled={pending} style={{
        border: "1px solid #147a4d", borderRadius: "6px",
        background: pending ? "#b8d9cf" : "#147a4d", color: "#fff",
        padding: "0.4rem 1rem", fontSize: "13px", fontWeight: 700, cursor: pending ? "not-allowed" : "pointer",
      }}>{pending ? "Importing…" : "Import this fixture"}</button>
    </form>
  );
}
