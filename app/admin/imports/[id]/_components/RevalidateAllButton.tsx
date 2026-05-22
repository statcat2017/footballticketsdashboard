"use client";

import { useActionState } from "react";
import { revalidateAll } from "../actions";

export function RevalidateAllButton({ batchId }: { batchId: number }) {
  const [state, action, pending] = useActionState(revalidateAll.bind(null, batchId), null);

  return (
    <form action={action} style={{ display: "inline-block" }}>
      {state?.error && <p style={{ color: "#a53a2d", fontSize: "12px", margin: "0 0 0.25rem" }}>{state.error}</p>}
      {state?.success && <p style={{ color: "#0e5737", fontSize: "12px", margin: "0 0 0.25rem" }}>{state.success}</p>}
      <button type="submit" disabled={pending} style={{
        border: pending ? "#dce3e2" : "1px solid #dce3e2", borderRadius: "6px",
        background: pending ? "#f5f7f7" : "#fff", color: pending ? "#b8b8b8" : "#17221f",
        padding: "0.4rem 1rem", fontSize: "13px", fontWeight: 600, cursor: pending ? "not-allowed" : "pointer",
      }}>{pending ? "Revalidating…" : "Revalidate all"}</button>
    </form>
  );
}
