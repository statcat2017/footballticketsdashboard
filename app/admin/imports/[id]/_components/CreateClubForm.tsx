"use client";

import { useActionState } from "react";
import { createClub } from "../actions";
import { LazyMapEditor } from "@/app/components/LazyMapEditor";

const labelStyle: React.CSSProperties = {
  fontSize: "12px", fontWeight: 600, color: "#34413e", display: "grid", gap: "0.15rem"
};
const inputStyle: React.CSSProperties = {
  padding: "0.35rem 0.5rem", border: "1px solid #dce3e2", borderRadius: "4px",
  fontSize: "13px", background: "#fff"
};

export function CreateClubForm({ batchId, rowId, rawValue, venues }: {
  batchId: number; rowId: number; rawValue: string;
  venues: { id: number; name: string; postcode: string }[];
}) {
  const [state, action, pending] = useActionState(createClub.bind(null, batchId), null);
  const p = "create_venue_";
  const latId = `${p}lat-${rowId}`;
  const lngId = `${p}lng-${rowId}`;
  const approxId = `${p}approx-${rowId}`;
  const precId = `${p}precision-${rowId}`;

  return (
    <details style={{ marginTop: "0.25rem" }}>
      <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#a53a2d" }}>
        Fix: Create new club
      </summary>
      <form action={action} style={{
        marginTop: "0.5rem", display: "grid", gap: "0.5rem",
        padding: "0.75rem", background: "#fafbfb", borderRadius: "6px",
        border: "1px solid #dce3e2"
      }}>
        {state?.error && <p style={{ color: "#a53a2d", fontSize: "12px", margin: 0 }}>{state.error}</p>}
        {state?.success && <p style={{ color: "#0e5737", fontSize: "12px", margin: 0 }}>{state.success}</p>}
        <input type="hidden" name="redirect_row_id" value={rowId} />
        <input type="hidden" name="alias" value={rawValue} />

        <label style={labelStyle}>Club name
          <input name="name" defaultValue={rawValue} required style={inputStyle} />
        </label>

        <fieldset style={{ border: "1px solid #dce3e2", borderRadius: "6px", padding: "0.5rem", margin: 0 }}>
          <legend style={{ fontSize: "12px", fontWeight: 600, color: "#34413e" }}>Venue</legend>
          <label style={labelStyle}>Use existing venue
            <select name="venue_id" style={inputStyle}>
              <option value="">-- Create new venue below --</option>
              {venues.map((v) => <option key={v.id} value={v.id}>#{v.id} {v.name}, {v.postcode}</option>)}
            </select>
          </label>

          <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.4rem" }}>
            <label style={labelStyle}>New venue name
              <input name={`${p}name`} style={inputStyle} />
            </label>

            <LazyMapEditor
              isApproximate={false}
              latInputId={latId}
              lngInputId={lngId}
              approxInputId={approxId}
              precisionInputId={precId}
              mode="create"
              postcodeName={`${p}postcode`}
            />

            <input id={latId} name={`${p}latitude`} type="number" step="any" style={{ ...inputStyle, display: "none" }} />
            <input id={lngId} name={`${p}longitude`} type="number" step="any" style={{ ...inputStyle, display: "none" }} />
            <input id={approxId} name={`${p}is_approximate`} type="checkbox" value="1" defaultChecked style={{ display: "none" }} />
            <select id={precId} name={`${p}coordinate_precision`} style={{ ...inputStyle, display: "none" }} defaultValue="ground_approximate">
              <option value="ground_approximate" />
            </select>

            <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input name={`${p}set_primary`} type="checkbox" value="1" defaultChecked />
              Set as home club&apos;s primary venue
            </label>
          </div>
        </fieldset>

        <button type="submit" disabled={pending} style={{
          justifySelf: "start", border: pending ? "#b8d9cf" : "1px solid #147a4d", borderRadius: "6px",
          background: pending ? "#b8d9cf" : "#147a4d", color: "#fff", padding: "0.35rem 0.9rem",
          fontSize: "13px", fontWeight: 700, cursor: pending ? "not-allowed" : "pointer",
        }}>{pending ? "Creating…" : "Create club & revalidate"}</button>
      </form>
    </details>
  );
}
