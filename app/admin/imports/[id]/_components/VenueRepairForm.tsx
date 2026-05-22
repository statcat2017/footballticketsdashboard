"use client";

import { useActionState } from "react";
import { assignExistingVenue, createVenueAndAssign } from "../actions";
import { LazyMapEditor } from "@/app/components/LazyMapEditor";

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

export function VenueRepairForm({ batchId, rowId, clubId, venues }: {
  batchId: number; rowId: number; clubId: number | null;
  venues: { id: number; name: string; postcode: string }[];
}) {
  const [assignState, assignAction, assignPending] = useActionState(assignExistingVenue.bind(null, batchId), null);
  const [createState, createAction, createPending] = useActionState(createVenueAndAssign.bind(null, batchId), null);
  const latId = `crv-lat-${rowId}`;
  const lngId = `crv-lng-${rowId}`;
  const approxId = `crv-approx-${rowId}`;
  const precId = `crv-precision-${rowId}`;

  return (
    <div style={{ marginTop: "0.25rem" }}>
      <details>
        <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#147a4d" }}>
          Fix: Assign existing venue
        </summary>
        <form action={assignAction} style={{
          marginTop: "0.5rem", display: "grid", gap: "0.5rem",
          padding: "0.75rem", background: "#fafbfb", borderRadius: "6px",
          border: "1px solid #dce3e2"
        }}>
          {assignState?.error && <p style={{ color: "#a53a2d", fontSize: "12px", margin: 0 }}>{assignState.error}</p>}
          {assignState?.success && <p style={{ color: "#0e5737", fontSize: "12px", margin: 0 }}>{assignState.success}</p>}
          <input type="hidden" name="redirect_row_id" value={rowId} />
          {clubId && <input type="hidden" name="club_id" value={clubId} />}

          <label style={labelStyle}>Venue
            <select name="venue_id" required style={inputStyle}>
              <option value="">Select venue...</option>
              {venues.map((v) => <option key={v.id} value={v.id}>#{v.id} {v.name}, {v.postcode}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Effective from
            <input name="effective_from" type="date" style={inputStyle}
              defaultValue={new Date(new Date().getFullYear(), 6, 1).toISOString().split("T")[0]} />
          </label>
          <button type="submit" disabled={assignPending} style={{
            ...greenBtnStyle,
            background: assignPending ? "#b8d9cf" : "#147a4d",
            cursor: assignPending ? "not-allowed" : "pointer",
          }}>{assignPending ? "Assigning…" : "Assign venue & revalidate"}</button>
        </form>
      </details>
      <details>
        <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#a53a2d" }}>
          Fix: Create venue and assign to home club
        </summary>
        <form action={createAction} style={{
          marginTop: "0.5rem", display: "grid", gap: "0.5rem",
          padding: "0.75rem", background: "#fafbfb", borderRadius: "6px",
          border: "1px solid #dce3e2"
        }}>
          {createState?.error && <p style={{ color: "#a53a2d", fontSize: "12px", margin: 0 }}>{createState.error}</p>}
          {createState?.success && <p style={{ color: "#0e5737", fontSize: "12px", margin: 0 }}>{createState.success}</p>}
          <input type="hidden" name="redirect_row_id" value={rowId} />
          {clubId && <input type="hidden" name="club_id" value={clubId} />}

          <label style={labelStyle}>Venue name
            <input name="name" required style={inputStyle} />
          </label>
          <label style={labelStyle}>Postcode
            <input name="postcode" required style={inputStyle} placeholder="e.g. SW1A 1AA" />
          </label>

          <LazyMapEditor
            isApproximate={false}
            latInputId={latId}
            lngInputId={lngId}
            approxInputId={approxId}
            precisionInputId={precId}
            mode="create"
          />

          <input id={latId} name="latitude" type="number" step="any" required style={{ ...inputStyle, display: "none" }} />
          <input id={lngId} name="longitude" type="number" step="any" required style={{ ...inputStyle, display: "none" }} />
          <input id={approxId} name="is_approximate" type="checkbox" value="1" style={{ display: "none" }} />
          <select id={precId} name="coordinate_precision" style={{ ...inputStyle, display: "none" }} defaultValue="ground_approximate">
            <option value="ground_approximate" />
          </select>

          <label style={labelStyle}>Effective from
            <input name="effective_from" type="date" style={inputStyle}
              defaultValue={new Date(new Date().getFullYear(), 6, 1).toISOString().split("T")[0]} />
          </label>
          <button type="submit" disabled={createPending} style={{
            ...greenBtnStyle,
            background: createPending ? "#b8d9cf" : "#147a4d",
            cursor: createPending ? "not-allowed" : "pointer",
          }}>{createPending ? "Creating…" : "Create venue, assign & revalidate"}</button>
        </form>
      </details>
    </div>
  );
}
