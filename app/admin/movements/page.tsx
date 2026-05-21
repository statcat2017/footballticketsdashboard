import React from "react";
import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { getDatabase } from "@/lib/db/client";
import { getMovementViewData } from "@/lib/admin/movements";

export const dynamic = "force-dynamic";

interface TierCard {
  label: string;
  path: string;
  tierMin: number;
  tierMax: number;
  description: string;
}

const TIER_CARDS: TierCard[] = [
  { label: "Tiers 1–5", path: "/admin/movements/tiers-1-5", tierMin: 1, tierMax: 5, description: "Premier League → National League" },
  { label: "Tiers 6–8", path: "/admin/movements/tiers-6-8", tierMin: 6, tierMax: 8, description: "National League North/South → Tier 8" },
  { label: "Tier 9", path: "/admin/movements/tier-9", tierMin: 9, tierMax: 9, description: "16 Step 5 leagues" },
  { label: "Tier 10", path: "/admin/movements/tier-10", tierMin: 10, tierMax: 10, description: "16 Step 6 leagues" },
];

export default async function AdminMovementsPage() {
  await requireAdminPageSession();
  const db = await getDatabase();

  const cards = await Promise.all(
    TIER_CARDS.map(async (tc) => {
      const view = await getMovementViewData(db, tc.tierMin, tc.tierMax);
      return { ...tc, totalFilled: view.totalFilled, totalSlots: view.totalSlots };
    })
  );

  return (
    <main style={{ maxWidth: "56rem", margin: "3rem auto", padding: "0 1rem", fontFamily: "system-ui, sans-serif" }}>
      <Link href="/admin" style={{ color: "#6f7e7a", fontSize: "13px", textDecoration: "none", fontWeight: 600 }}>
        &larr; Dashboard
      </Link>
      <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>End-of-season movements</h1>
      <p style={{ margin: "0.25rem 0 1.5rem", color: "#6f7e7a", fontSize: "14px" }}>
        Create promotion and relegation slots, assign clubs, then apply all changes at once.
      </p>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {cards.map((card) => (
          <Link key={card.path} href={card.path} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{
              border: "1px solid #dce3e2",
              borderRadius: "8px",
              padding: "1.25rem",
              background: "#fff",
              transition: "box-shadow 0.15s",
            }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{card.label}</h2>
              <p style={{ margin: "0.25rem 0 0", color: "#6f7e7a", fontSize: "13px" }}>{card.description}</p>
              {card.totalSlots > 0 && (
                <p style={{ margin: "0.5rem 0 0", fontSize: "13px", fontWeight: 600 }}>
                  {card.totalFilled}/{card.totalSlots} filled
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
