"use client";

import { useActionState } from "react";
import { editRow } from "../actions";

const labelStyle: React.CSSProperties = {
  fontSize: "12px", fontWeight: 600, color: "#34413e", display: "grid", gap: "0.15rem"
};
const inputStyle: React.CSSProperties = {
  padding: "0.35rem 0.5rem", border: "1px solid #dce3e2", borderRadius: "4px",
  fontSize: "13px", background: "#fff"
};
const greenBtnStyle: React.CSSProperties = {
  justifySelf: "start", border: "1px solid #147a4d", borderRadius: "6px",
  background: "#147a4d", color: "#fff", padding: "0.35rem 0.9rem",
  fontSize: "13px", fontWeight: 700, cursor: "pointer"
};

export function CompetitionRepairForm({ batchId, rowId, rawValue, competitions }: {
  batchId: number; rowId: number; rawValue: string;
  competitions: { code: string; name: string; kind: string }[];
}) {
  const [state, action, pending] = useActionState(editRow.bind(null, batchId, rowId), null);

  const compDefault = (() => {
    const match = competitions.find(
      (c) => c.code === rawValue || c.name === rawValue
    );
    return match?.code ?? "";
  })();

  return (
    <div style={{
      marginTop: "0.25rem", padding: "0.75rem", background: "#fafbfb", borderRadius: "6px",
      border: "1px solid #dce3e2", display: "grid", gap: "0.5rem"
    }}>
      <form action={action} style={{ display: "grid", gap: "0.5rem" }}>
        {state?.error && <p style={{ color: "#a53a2d", fontSize: "12px", margin: 0 }}>{state.error}</p>}
        {state?.success && <p style={{ color: "#0e5737", fontSize: "12px", margin: 0 }}>{state.success}</p>}

        <label style={labelStyle}>Competition
          <select name="competitionRaw" defaultValue={compDefault} style={inputStyle} id={`comp-select-${rowId}`}>
            <option value="">-- Select competition --</option>
            {competitions.map((c) => (
              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input type="checkbox" name="isFriendly" value="1" style={{ transform: "scale(1.2)" }} />
          This is a friendly (no formal competition)
        </label>

        <button type="submit" disabled={pending} style={{
          ...greenBtnStyle,
          background: pending ? "#b8d9cf" : "#147a4d",
          cursor: pending ? "not-allowed" : "pointer",
        }}>{pending ? "Saving…" : "Set competition & revalidate"}</button>
      </form>
    </div>
  );
}
