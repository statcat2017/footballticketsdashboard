import React from "react";

import { getAdminConfig } from "@/lib/admin/config";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const configured = Boolean(await getAdminConfig());

  return (
    <main style={{ maxWidth: "28rem", margin: "4rem auto", padding: "0 1rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Admin login</h1>
      {!configured ? (
        <p>Admin access is unavailable.</p>
      ) : (
        <form method="post" action="/api/admin/login" style={{ display: "grid", gap: "1rem" }}>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Admin secret
            <input name="secret" type="password" required autoComplete="current-password" />
          </label>
          <button type="submit">Log in</button>
        </form>
      )}
    </main>
  );
}
