"use client";

import { useActionState } from "react";
import { editRow } from "../actions";
import type { ImportBatchRow } from "@/lib/import/types";

const labelStyle: React.CSSProperties = {
  fontSize: "12px", fontWeight: 600, color: "#34413e", display: "grid", gap: "0.15rem"
};
const inputStyle: React.CSSProperties = {
  padding: "0.35rem 0.5rem", border: "1px solid #dce3e2", borderRadius: "4px",
  fontSize: "13px", background: "#fff"
};

export function RowEditForm({ batchId, rowId, row, competitions }: {
  batchId: number; rowId: number; row: ImportBatchRow;
  competitions: { code: string; name: string; kind: string }[];
}) {
  const [state, action, pending] = useActionState(editRow.bind(null, batchId, rowId), null);

  const isFriendly = row.competitionResolvedCode === "FRIENDLY" || (row.competitionRaw ?? "").toLowerCase().includes("friendly");
  const compDefault = (() => {
    if (row.competitionResolvedCode) return row.competitionResolvedCode;
    const match = competitions.find(
      (c) => c.code === row.competitionRaw || c.name === row.competitionRaw
    );
    return match?.code ?? "";
  })();

  return (
    <div style={{
      marginTop: "0.25rem", padding: "0.5rem", background: "#fafbfb", borderRadius: "6px",
      border: "1px solid #dce3e2"
    }}>
      <form action={action} style={{ display: "grid", gap: "0.35rem" }}>
        {state?.error && <p style={{ color: "#a53a2d", fontSize: "12px", margin: 0 }}>{state.error}</p>}
        {state?.success && <p style={{ color: "#0e5737", fontSize: "12px", margin: 0 }}>{state.success}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
          <label style={labelStyle}>Home
            <input name="homeParticipantRaw" defaultValue={row.homeParticipantRaw ?? ""} style={inputStyle} />
          </label>
          <label style={labelStyle}>Away
            <input name="awayParticipantRaw" defaultValue={row.awayParticipantRaw ?? ""} style={inputStyle} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
          <label style={labelStyle}>Competition
            <select name="competitionRaw" defaultValue={compDefault} style={inputStyle} id={`edit-comp-${rowId}`}>
              <option value="">-- Select --</option>
              {competitions.map((c) => (
                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>Venue
            <input name="venueRaw" defaultValue={row.venueRaw ?? ""} style={inputStyle} />
          </label>
        </div>
        <label style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input type="checkbox" name="isFriendly" value="1" defaultChecked={isFriendly} style={{ transform: "scale(1.2)" }} />
          This is a friendly (no formal competition)
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
          <label style={labelStyle}>Date
            <input name="kickoffDate" defaultValue={row.kickoffDate ?? ""} style={inputStyle} />
          </label>
          <label style={labelStyle}>Time
            <input name="kickoffTime" defaultValue={row.kickoffTime ?? ""} style={inputStyle} />
          </label>
        </div>
        <label style={labelStyle}>Ticket URL
          <input name="ticketUrl" defaultValue={row.ticketUrl ?? ""} style={inputStyle} />
        </label>
        <button type="submit" disabled={pending} style={{
          justifySelf: "start", border: pending ? "#b8d9cf" : "1px solid #147a4d", borderRadius: "6px",
          background: pending ? "#b8d9cf" : "#147a4d", color: "#fff", padding: "0.35rem 0.9rem",
          fontSize: "13px", fontWeight: 700, cursor: pending ? "not-allowed" : "pointer",
        }}>{pending ? "Saving…" : "Save & revalidate"}</button>
      </form>
    </div>
  );
}
