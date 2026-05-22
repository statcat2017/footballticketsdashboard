"use client";

import { useActionState } from "react";
import { createCompetition } from "../actions";

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

export function CreateCompetitionForm({ batchId, rawValue, code }: {
  batchId: number; rawValue: string; code: string;
}) {
  const [state, action, pending] = useActionState(createCompetition.bind(null, batchId), null);

  return (
    <details style={{ marginTop: "0.5rem" }}>
      <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#6f7e7a" }}>
        Create new competition instead
      </summary>
      <form action={action} style={{
        marginTop: "0.5rem", display: "grid", gap: "0.5rem",
        padding: "0.75rem", background: "#fafbfb", borderRadius: "6px",
        border: "1px solid #dce3e2"
      }}>
        {state?.error && <p style={{ color: "#a53a2d", fontSize: "12px", margin: 0 }}>{state.error}</p>}
        {state?.success && <p style={{ color: "#0e5737", fontSize: "12px", margin: 0 }}>{state.success}</p>}
        <label style={labelStyle}>Code
          <input name="code" defaultValue={code} style={inputStyle} />
        </label>
        <label style={labelStyle}>Name
          <input name="name" defaultValue={rawValue} style={inputStyle} />
        </label>
        <label style={labelStyle}>Kind
          <select name="kind" defaultValue="cup" style={inputStyle}>
            <option value="cup">Cup</option>
            <option value="league">League</option>
          </select>
        </label>
        <label style={labelStyle}>Tier <span style={{ fontWeight: 400, color: "#6f7e7a" }}>(only used for league)</span>
          <input name="tier" type="number" min="1" max="10" defaultValue={code.startsWith("T") ? code.slice(1) : "7"} style={inputStyle} />
        </label>
        <button type="submit" disabled={pending} style={{
          ...greenBtnStyle,
          background: pending ? "#b8d9cf" : "#147a4d",
          cursor: pending ? "not-allowed" : "pointer",
        }}>{pending ? "Creating…" : "Create & revalidate batch"}</button>
      </form>
    </details>
  );
}
