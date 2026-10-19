import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { getDatabase } from "@/lib/db/client";
import { CompetitionCategoryManagement } from "./_components/CompetitionCategoryManagement";

export const dynamic = "force-dynamic";

export default async function AdminCompetitionsPage() {
  await requireAdminPageSession();

  const db = await getDatabase();
  const competitions = await db.all<{
    code: string;
    name: string;
    kind: string;
    public_category: string;
  }>(`SELECT code, name, kind, public_category FROM competitions ORDER BY name, code`);

  return (
    <main style={{ maxWidth: "64rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "1.25rem 0", borderBottom: "1px solid #dce3e2", marginBottom: "1.25rem" }}>
        <Link href="/admin" style={{ color: "#6f7e7a", fontSize: "13px", textDecoration: "none", fontWeight: 600 }}>
          &larr; Dashboard
        </Link>
        <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>Competition categories</h1>
        <p style={{ color: "#6f7e7a", fontSize: "14px", margin: "0.45rem 0 0" }}>
          Set the public category used to group fixtures in search. Changes are recorded in the admin audit log.
        </p>
      </header>

      <CompetitionCategoryManagement competitions={competitions} />
    </main>
  );
}
