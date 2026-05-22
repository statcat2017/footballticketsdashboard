"use client";

import { useActionState } from "react";
import { bulkApply } from "../actions";

export function BulkApplyForm({ batchId, applyableCount }: {
  batchId: number; applyableCount: number;
}) {
  const [state, action, pending] = useActionState(bulkApply.bind(null, batchId), null);

  return (
    <form action={action} style={{
      border: state?.error ? "1px solid #f0beb7" : "1px solid #147a4d", borderRadius: "8px",
      background: state?.error ? "#fde9e5" : "#f0faf6", padding: "0.75rem 1rem"
    }}>
      {state?.success && <p style={{ color: "#0e5737", fontSize: "13px", margin: "0 0 0.5rem", fontWeight: 600 }}>{state.success}</p>}
      {state?.error && <p style={{ color: "#a53a2d", fontSize: "13px", margin: "0 0 0.5rem", fontWeight: 600 }}>{state.error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "13px", cursor: "pointer" }}>
          <input type="checkbox" name="confirm" value="1" required />
          Import all {applyableCount} ready fixtures
        </label>
        <button type="submit" disabled={pending} style={{
          border: pending ? "#b8d9cf" : "1px solid #147a4d", borderRadius: "6px",
          background: pending ? "#b8d9cf" : "#147a4d", color: "#fff",
          padding: "0.4rem 1rem", fontSize: "13px", fontWeight: 700, cursor: pending ? "not-allowed" : "pointer",
        }}>{pending ? "Importing…" : "Import all ready"}</button>
      </div>
    </form>
  );
}
