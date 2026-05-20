"use client";

import Link from "next/link";
import type { DivisionSummary } from "@/lib/db/divisions";

interface Props {
  divisions: DivisionSummary[];
}

export function DivisionList({ divisions }: Props) {
  const grouped = new Map<number, DivisionSummary[]>();
  for (const d of divisions) {
    const list = grouped.get(d.level) ?? [];
    list.push(d);
    grouped.set(d.level, list);
  }

  const levels = Array.from(grouped.keys()).sort((a, b) => a - b);

  return (
    <div className="divisions-page">
      <nav className="top-nav" aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>nearme.fc</span>
        </div>
        <div className="nav-links">
          <Link href="/">Fixtures</Link>
          <Link href="/divisions" className="active">Divisions</Link>
          <Link href="/pyramid">Pyramid</Link>
        </div>
      </nav>

      <div className="divisions-header">
        <h1>Divisions</h1>
        <p>Browse clubs and grounds across the English football pyramid.</p>
      </div>

      {levels.map((level) => (
        <div key={level} className="division-group">
          <h2 className="division-group-title">Level {level}</h2>
          <div className="division-grid">
            {grouped.get(level)!.map((div) => (
              <Link
                key={div.id}
                href={`/divisions/${div.code}`}
                className="division-card"
              >
                <span className="division-card-name">{div.name}</span>
                <span className="division-card-count">
                  {div.club_count} club{div.club_count !== 1 ? "s" : ""}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
