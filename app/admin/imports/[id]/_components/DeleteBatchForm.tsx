"use client";

import { useActionState } from "react";
import { deleteBatchAction } from "../actions";

export function DeleteBatchForm({ batchId }: { batchId: number }) {
  const [state, action, pending] = useActionState(deleteBatchAction.bind(null, batchId), null);

  return (
    <section style={{
      border: "1px solid #e0b3a8", borderRadius: "8px",
      background: "#fdf6f5", padding: "1rem", marginTop: "1.5rem"
    }}>
      <p style={{ margin: "0 0 0.5rem", fontWeight: 600, fontSize: "14px", color: "#a53a2d" }}>
        Danger zone
      </p>
      {state?.error && <p style={{ color: "#a53a2d", fontSize: "13px", margin: "0 0 0.5rem" }}>{state.error}</p>}
      <form action={action} id="delete-batch-form">
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "14px", cursor: "pointer", marginBottom: "0.75rem" }}>
          <input type="checkbox" name="confirm" value="1" required />
          I understand this will permanently delete this batch.
        </label>
        <button type="submit" disabled={pending} style={{
          border: pending ? "#c0392b" : "1px solid #c0392b", borderRadius: "7px",
          background: pending ? "#e08a80" : "#e74c3c", color: "#fff",
          padding: "0.5rem 1.25rem", fontSize: "14px", fontWeight: 700, cursor: pending ? "not-allowed" : "pointer",
        }}>
          {pending ? "Deleting…" : "Delete batch"}
        </button>
      </form>
    </section>
  );
}
