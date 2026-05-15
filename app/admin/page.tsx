import Link from "next/link";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { requireAdminPageSession } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();

  return (
    <main style={{ maxWidth: "56rem", margin: "3rem auto", padding: "0 1rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <div>
          <h1>Admin</h1>
          <p>Signed in as {session.actor}. Data editing tools will be added in later phases.</p>
        </div>
        <form method="post" action="/api/admin/logout">
          <input type="hidden" name="csrf" value={csrfToken} />
          <button type="submit">Log out</button>
        </form>
      </header>
      <section style={{ marginTop: "1.5rem" }}>
        <h2>Phase 2A &mdash; Club Browser</h2>
        <p style={{ margin: "0.25rem 0 0.75rem", color: "#6f7e7a", fontSize: "14px" }}>
          Read-only club and ground lookup by season and division.
        </p>
        <Link href="/admin/clubs" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          border: "1px solid #147a4d",
          borderRadius: "7px",
          background: "#147a4d",
          color: "#fff",
          padding: "0.5rem 1rem",
          fontSize: "14px",
          fontWeight: 700,
          textDecoration: "none"
        }}>
          Browse clubs &rarr;
        </Link>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Phase 1 foundation</h2>
        <ul>
          <li>Admin session is active.</li>
          <li>CSRF token generation is available for mutation routes.</li>
          <li>Audit logging and atomic write batches are available to later admin features.</li>
        </ul>
      </section>
    </main>
  );
}
