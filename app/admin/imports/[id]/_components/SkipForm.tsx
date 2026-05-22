"use client";

import { useActionState } from "react";
import { skipRowAction } from "../actions";

const labelStyle: React.CSSProperties = {
  fontSize: "12px", fontWeight: 600, color: "#34413e", display: "grid", gap: "0.15rem"
};
const inputStyle: React.CSSProperties = {
  padding: "0.35rem 0.5rem", border: "1px solid #dce3e2", borderRadius: "4px",
  fontSize: "13px", background: "#fff"
};

export function SkipForm({ batchId, rowId }: { batchId: number; rowId: number }) {
  const [state, action, pending] = useActionState(skipRowAction.bind(null, batchId, rowId), null);

  return (
    <details style={{ display: "inline-block" }}>
      <summary style={{
        cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#a53a2d", padding: "0.25rem 0.5rem"
      }}>Skip</summary>
      <form action={action} style={{
        marginTop: "0.25rem", padding: "0.5rem", background: "#fafbfb", borderRadius: "6px",
        border: "1px solid #dce3e2", display: "grid", gap: "0.5rem", maxWidth: "300px"
      }}>
        {state?.error && <p style={{ color: "#a53a2d", fontSize: "12px", margin: 0 }}>{state.error}</p>}
        {state?.success && <p style={{ color: "#0e5737", fontSize: "12px", margin: 0 }}>{state.success}</p>}
        <label style={labelStyle}>Reason
          <select name="reason" required style={inputStyle}>
            <option value="">Select...</option>
            <option value="duplicate">Duplicate</option>
            <option value="bad_source_row">Bad source row</option>
            <option value="not_relevant">Not relevant</option>
            <option value="needs_later_review">Needs later review</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label style={labelStyle}>Note
          <input name="note" style={inputStyle} />
        </label>
        <button type="submit" disabled={pending} style={{
          borderRadius: "6px", padding: "0.3rem 0.7rem",
          fontSize: "12px", fontWeight: 600, cursor: pending ? "not-allowed" : "pointer",
          color: pending ? "#b8a8a3" : "#a53a2d", border: pending ? "#dce3e2" : "1px solid #f0beb7",
          background: "#fff",
        }}>{pending ? "Skipping…" : "Skip fixture"}</button>
      </form>
    </details>
  );
}
