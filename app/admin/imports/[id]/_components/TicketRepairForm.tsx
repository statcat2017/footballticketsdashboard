"use client";

import { useActionState } from "react";
import { addClubTicketInfo, acknowledgeMissingTicketInfo } from "../actions";

const labelStyle: React.CSSProperties = {
  fontSize: "12px", fontWeight: 600, color: "#34413e", display: "grid", gap: "0.15rem"
};
const inputStyle: React.CSSProperties = {
  padding: "0.35rem 0.5rem", border: "1px solid #dce3e2", borderRadius: "4px",
  fontSize: "13px", background: "#fff"
};

export function TicketRepairForm({ rowId, batchId, homeResolvedId }: {
  rowId: number; batchId: number; homeResolvedId: number | null;
}) {
  const [ticketState, ticketAction, ticketPending] = useActionState(addClubTicketInfo.bind(null, batchId), null);
  const [ackState, ackAction, ackPending] = useActionState(acknowledgeMissingTicketInfo.bind(null, batchId), null);

  return (
    <div style={{
      marginTop: "0.25rem", padding: "0.5rem", background: "#fafbfb", borderRadius: "6px",
      border: "1px solid #dce3e2", maxWidth: "400px"
    }}>
      <form action={ticketAction} style={{ display: "grid", gap: "0.5rem" }}>
        {ticketState?.error && <p style={{ color: "#a53a2d", fontSize: "12px", margin: 0 }}>{ticketState.error}</p>}
        {ticketState?.success && <p style={{ color: "#0e5737", fontSize: "12px", margin: 0 }}>{ticketState.success}</p>}
        <input type="hidden" name="redirect_row_id" value={rowId} />
        {homeResolvedId && <input type="hidden" name="club_id" value={homeResolvedId} />}

        <label style={labelStyle}>Ticket URL (required)
          <input name="generic_ticket_url" type="url" required style={inputStyle} />
        </label>
        <label style={labelStyle}>Sale mode
          <select name="sale_mode" style={inputStyle}>
            <option value="">Unknown</option>
            <option value="all_ticket">All ticket</option>
            <option value="pay_on_gate">Pay on gate</option>
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <label style={labelStyle}>Adult price (pence)
            <input name="adult_price_pence" type="number" style={inputStyle} />
          </label>
          <label style={labelStyle}>Concession price (pence)
            <input name="concession_price_pence" type="number" style={inputStyle} />
          </label>
        </div>
        <button type="submit" disabled={ticketPending} style={{
          justifySelf: "start", border: ticketPending ? "#b8d9cf" : "1px solid #147a4d", borderRadius: "6px",
          background: ticketPending ? "#b8d9cf" : "#147a4d", color: "#fff", padding: "0.35rem 0.9rem",
          fontSize: "13px", fontWeight: 700, cursor: ticketPending ? "not-allowed" : "pointer",
        }}>{ticketPending ? "Saving…" : "Save ticket info"}</button>
      </form>

      <form action={ackAction} style={{ marginTop: "0.5rem" }}>
        {ackState?.error && <p style={{ color: "#a53a2d", fontSize: "12px", margin: "0 0 0.25rem" }}>{ackState.error}</p>}
        {ackState?.success && <p style={{ color: "#0e5737", fontSize: "12px", margin: "0 0 0.25rem" }}>{ackState.success}</p>}
        <input type="hidden" name="issue_key" value="missing_ticket_info" />
        <input type="hidden" name="row_id" value={rowId} />
        <button type="submit" disabled={ackPending} style={{
          borderRadius: "6px", padding: "0.3rem 0.7rem",
          fontSize: "12px", fontWeight: 600, cursor: ackPending ? "not-allowed" : "pointer",
          color: ackPending ? "#b8b8b8" : "#6f7e7a", border: ackPending ? "#dce3e2" : "1px solid #dce3e2",
          background: "#fff",
        }}>{ackPending ? "Acknowledging…" : "Acknowledge (batch only)"}</button>
      </form>
    </div>
  );
}
