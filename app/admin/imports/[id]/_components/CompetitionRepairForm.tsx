"use client";

import { useActionState, useState } from "react";
import { editRow, updateCompetitionCategory } from "../actions";

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
  competitions: { code: string; name: string; kind: string; public_category: string }[];
}) {
  const [state, action, pending] = useActionState(editRow.bind(null, batchId, rowId), null);
  const [categoryState, categoryAction, categoryPending] = useActionState(
    updateCompetitionCategory.bind(null, batchId), null
  );

  const compDefault = (() => {
    const match = competitions.find(
      (c) => c.code === rawValue || c.name === rawValue
    );
    return match?.code ?? "";
  })();
  const categoryDefault = competitions.find((competition) => competition.code === compDefault)?.public_category ?? "uncategorized";
  const [categoryCompetitionCode, setCategoryCompetitionCode] = useState(compDefault);
  const [selectedCategory, setSelectedCategory] = useState(categoryDefault);

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

      <form action={categoryAction} style={{ display: "grid", gap: "0.5rem", borderTop: "1px solid #dce3e2", paddingTop: "0.65rem" }}>
        <strong style={{ fontSize: "12px", color: "#34413e" }}>Correct an existing competition category</strong>
        {categoryState?.error && <p role="alert" style={{ color: "#a53a2d", fontSize: "12px", margin: 0 }}>{categoryState.error}</p>}
        {categoryState?.success && <p role="status" style={{ color: "#0e5737", fontSize: "12px", margin: 0 }}>{categoryState.success}</p>}
        <label style={labelStyle}>Existing competition
          <select
            name="competitionCode"
            value={categoryCompetitionCode}
            required
            style={inputStyle}
            onChange={(event) => {
              const code = event.target.value;
              setCategoryCompetitionCode(code);
              setSelectedCategory(competitions.find((competition) => competition.code === code)?.public_category ?? "uncategorized");
            }}
          >
            <option value="">-- Select competition --</option>
            {competitions.map((competition) => (
              <option key={competition.code} value={competition.code}>
                {competition.name} ({competition.code}; current category: {competition.public_category})
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>Public category
          <select name="publicCategory" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} required style={inputStyle}>
            <option value="premier-league">Premier League</option>
            <option value="efl">EFL</option>
            <option value="non-league">Non League</option>
            <option value="womens">Women’s football</option>
            <option value="cup">Cup</option>
            <option value="friendly">Friendly</option>
            <option value="uncategorized">Uncategorized</option>
          </select>
        </label>
        <button type="submit" disabled={categoryPending} style={{ ...greenBtnStyle, cursor: categoryPending ? "not-allowed" : "pointer" }}>
          {categoryPending ? "Updating…" : "Update category"}
        </button>
      </form>
    </div>
  );
}
