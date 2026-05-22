"use client";

import { useActionState } from "react";
import { matchExistingClub } from "../actions";

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

export function MatchClubForm({ batchId, rowId, rawValue, competitionCode, clubs }: {
  batchId: number; rowId: number; rawValue: string;
  competitionCode: string | null;
  clubs: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState(matchExistingClub.bind(null, batchId), null);

  return (
    <details style={{ marginTop: "0.25rem" }}>
      <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#147a4d" }}>
        Fix: Match club
      </summary>
      <form action={action} style={{
        marginTop: "0.5rem", display: "grid", gap: "0.5rem",
        padding: "0.75rem", background: "#fafbfb", borderRadius: "6px",
        border: "1px solid #dce3e2", maxWidth: "400px"
      }}>
        {state?.error && <p style={{ color: "#a53a2d", fontSize: "12px", margin: 0 }}>{state.error}</p>}
        {state?.success && <p style={{ color: "#0e5737", fontSize: "12px", margin: 0 }}>{state.success}</p>}
        <input type="hidden" name="redirect_row_id" value={rowId} />

        <label style={labelStyle}>Alias (raw name from import)
          <input name="alias" defaultValue={rawValue} style={inputStyle} />
        </label>
        <label style={labelStyle}>Match to club
          <select name="club_id" required style={inputStyle}>
            <option value="">Select club...</option>
            {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Scope
          <select name="competition_code" style={inputStyle}>
            <option value="">Global (unscoped)</option>
            {competitionCode && <option value={competitionCode}>{competitionCode}</option>}
          </select>
        </label>
        <button type="submit" disabled={pending} style={{
          ...greenBtnStyle,
          background: pending ? "#b8d9cf" : "#147a4d",
          cursor: pending ? "not-allowed" : "pointer",
        }}>{pending ? "Adding…" : "Add alias & revalidate"}</button>
      </form>
    </details>
  );
}
