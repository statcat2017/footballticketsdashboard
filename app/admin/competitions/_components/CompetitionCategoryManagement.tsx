"use client";

import { useActionState } from "react";
import { PUBLIC_COMPETITION_CATEGORY_OPTIONS } from "@/lib/admin/competitionCategories";
import { updateCompetitionCategoryFromAdmin } from "@/app/admin/imports/[id]/actions";
import type { ActionState } from "@/app/admin/imports/[id]/actions";

export interface CompetitionCategoryRecord {
  code: string;
  name: string;
  kind: string;
  public_category: string;
}

export function CompetitionCategoryManagement({ competitions }: {
  competitions: CompetitionCategoryRecord[];
}) {
  if (competitions.length === 0) {
    return <p>No competitions are available to classify.</p>;
  }

  return (
    <div style={{ display: "grid", gap: "0.65rem" }}>
      {competitions.map((competition) => (
        <CompetitionCategoryRow key={competition.code} competition={competition} />
      ))}
    </div>
  );
}

function CompetitionCategoryRow({ competition }: { competition: CompetitionCategoryRecord }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    updateCompetitionCategoryFromAdmin,
    null,
  );
  const selectId = `competition-category-${competition.code}`;

  return (
    <section style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "end",
      gap: "0.75rem",
      border: "1px solid #dce3e2",
      borderRadius: "8px",
      background: "#fff",
      padding: "0.8rem 1rem",
    }}>
      <div style={{ flex: "1 1 12rem" }}>
        <div style={{ color: "#17221f", fontWeight: 700 }}>{competition.name}</div>
        <div style={{ color: "#6f7e7a", fontSize: "12px" }}>{competition.code} · {competition.kind}</div>
      </div>
      <form action={action} style={{ display: "flex", flex: "2 1 24rem", flexWrap: "wrap", alignItems: "end", gap: "0.75rem" }}>
        <input type="hidden" name="competitionCode" value={competition.code} />
        <label htmlFor={selectId} style={{ display: "grid", flex: "1 1 12rem", gap: "0.25rem", color: "#34413e", fontSize: "12px", fontWeight: 600 }}>
          Public category
          <select
            id={selectId}
            name="publicCategory"
            defaultValue={competition.public_category}
            required
            style={{ padding: "0.4rem 0.5rem", border: "1px solid #dce3e2", borderRadius: "4px", background: "#fff" }}
          >
            {PUBLIC_COMPETITION_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending} style={{
          border: "1px solid #147a4d",
          borderRadius: "6px",
          background: pending ? "#b8d9cf" : "#147a4d",
          color: "#fff",
          padding: "0.45rem 0.8rem",
          fontSize: "13px",
          fontWeight: 700,
          cursor: pending ? "not-allowed" : "pointer",
        }}>{pending ? "Saving…" : "Save category"}</button>
        {state?.error && <p role="alert" style={{ flex: "1 0 100%", color: "#a53a2d", fontSize: "13px", margin: 0 }}>{state.error}</p>}
        {state?.success && <p role="status" style={{ flex: "1 0 100%", color: "#0e5737", fontSize: "13px", margin: 0 }}>{state.success}</p>}
      </form>
    </section>
  );
}
