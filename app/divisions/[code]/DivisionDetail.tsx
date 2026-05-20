"use client";

import Link from "next/link";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { DivisionDetail } from "@/lib/db/divisions";
import type { GroundMarker } from "@/app/components/GroundsMap";

const GroundsMap = dynamic(() => import("@/app/components/GroundsMap").then((m) => ({ default: m.GroundsMapInner })), {
  ssr: false,
  loading: () => <div className="grounds-map-container grounds-map-loading">Loading map…</div>
});

interface Props {
  division: DivisionDetail;
}

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0
});

function formatMoney(pence: number | null): string {
  if (pence === null) return "TBC";
  return moneyFormatter.format(pence / 100);
}

export function DivisionDetail({ division }: Props) {
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  const grounds: GroundMarker[] = division.clubs
    .filter((c) => c.latitude !== 0 && c.longitude !== 0)
    .map((c) => ({
      id: c.clubId,
      name: c.venueName,
      lat: c.latitude,
      lng: c.longitude
    }));

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

      <div className="division-detail-header">
        <div className="division-detail-breadcrumb">
          <Link href="/divisions">Divisions</Link>
          <span>/</span>
          <span>{division.name}</span>
        </div>
        <h1>{division.name}</h1>
        <div className="division-detail-meta">
          <span className="level-badge">Level {division.level}</span>
          <span>{division.clubs.length} club{division.clubs.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {division.clubs.length === 0 ? (
        <div className="division-empty">
          <p>No clubs assigned to this division yet.</p>
        </div>
      ) : (
        <div className="division-detail-layout">
          <div className="division-club-table-wrapper">
            <table className="division-club-table">
              <thead>
                <tr>
                  <th>Club</th>
                  <th>Ground</th>
                  <th>Postcode</th>
                  <th>Admission</th>
                </tr>
              </thead>
              <tbody>
                {division.clubs.map((club) => (
                  <tr
                    key={club.clubId}
                    className={`club-row${highlightedId === club.clubId ? " highlighted" : ""}`}
                    onMouseEnter={() => setHighlightedId(club.clubId)}
                    onMouseLeave={() => setHighlightedId(null)}
                  >
                    <td>
                      {club.officialSiteUrl ? (
                        <a href={club.officialSiteUrl} target="_blank" rel="noreferrer" className="club-link">
                          {club.clubName}
                        </a>
                      ) : (
                        club.clubName
                      )}
                    </td>
                    <td>{club.venueName}</td>
                    <td>{club.venuePostcode || "TBC"}</td>
                    <td>
                      {club.saleMode === "pay_on_gate" ? (
                        <span className="badge limited">Pay on gate</span>
                      ) : club.adultPricePence !== null ? (
                        <span>{formatMoney(club.adultPricePence)}</span>
                      ) : (
                        <span className="text-muted">TBC</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grounds-map-container">
            <GroundsMap grounds={grounds} highlightedId={highlightedId} />
          </div>
        </div>
      )}
    </div>
  );
}
