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
          <p>
            Signed in as {session.actor}.{" "}
            <Link href="/" style={{ color: "#147a4d" }}>View user dashboard</Link>
          </p>
        </div>
        <form method="post" action="/api/admin/logout">
          <input type="hidden" name="csrf" value={csrfToken} />
          <button type="submit">Log out</button>
        </form>
      </header>
      <section style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/admin/venues" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            border: "1px solid #147a4d",
            borderRadius: "7px",
            background: "#fff",
            color: "#147a4d",
            padding: "0.5rem 1rem",
            fontSize: "14px",
            fontWeight: 700,
            textDecoration: "none"
          }}>
            Manage venues &rarr;
          </Link>
          <Link href="/admin/data-quality" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            border: "1px solid #a76800",
            borderRadius: "7px",
            background: "#fdf3e9",
            color: "#8a5a00",
            padding: "0.5rem 1rem",
            fontSize: "14px",
            fontWeight: 700,
            textDecoration: "none"
          }}>
            Data quality &rarr;
          </Link>
          <Link href="/admin/imports" style={{
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
            Import fixtures &rarr;
          </Link>
          <Link href="/admin/publish" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            border: "1px solid #147a4d",
            borderRadius: "7px",
            background: "#fff",
            color: "#147a4d",
            padding: "0.5rem 1rem",
            fontSize: "14px",
            fontWeight: 700,
            textDecoration: "none"
          }}>
            Clubs & Divisions &rarr;
          </Link>
          <Link href="/admin/movements" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            border: "1px solid #a76800",
            borderRadius: "7px",
            background: "#fdf3e9",
            color: "#8a5a00",
            padding: "0.5rem 1rem",
            fontSize: "14px",
            fontWeight: 700,
            textDecoration: "none"
          }}>
            End-of-season movements &rarr;
          </Link>
          <Link href="/admin/imports/sources" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            border: "1px solid #6f7e7a",
            borderRadius: "7px",
            background: "#fff",
            color: "#6f7e7a",
            padding: "0.5rem 1rem",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none"
          }}>
            Sources &rarr;
          </Link>
        </div>
      </section>
    </main>
  );
}
