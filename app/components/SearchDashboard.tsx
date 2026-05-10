"use client";

import { FormEvent, useMemo, useState } from "react";
import type { FixtureResult } from "@/lib/types";

type SearchState = "idle" | "loading" | "ready" | "error";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function twoWeeksFromToday(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

function formatPrice(pence: number | null): string {
  if (pence === null) {
    return "Price unknown";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(pence / 100);
}

function formatKickoff(value: string | null, historical: boolean): string {
  if (value === null) {
    return "Kickoff TBC";
  }

  const formatted = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London"
  }).format(new Date(value));

  return historical ? `${formatted} (historical demo)` : formatted;
}

export function SearchDashboard() {
  const [postcode, setPostcode] = useState("SW6 1HS");
  const [radiusMiles, setRadiusMiles] = useState("20");
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(twoWeeksFromToday());
  const [state, setState] = useState<SearchState>("idle");
  const [error, setError] = useState("");
  const [results, setResults] = useState<FixtureResult[]>([]);
  const [correctionFixture, setCorrectionFixture] = useState<FixtureResult | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const [correctionStatus, setCorrectionStatus] = useState("");

  const resultCount = useMemo(() => results.length, [results]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setError("");
    setCorrectionStatus("");

    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postcode,
        radiusMiles: Number(radiusMiles),
        dateFrom,
        dateTo
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Search failed.");
      setState("error");
      return;
    }

    setResults(payload.results);
    setState("ready");
  }

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!correctionFixture) {
      return;
    }

    const response = await fetch("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fixtureId: correctionFixture.id,
        clubName: correctionFixture.homeClub,
        priceText: correctionText
      })
    });

    if (response.ok) {
      setCorrectionStatus("Thanks. Your correction has been saved for review.");
      setCorrectionText("");
      setCorrectionFixture(null);
    } else {
      setCorrectionStatus("Could not save that correction. Please try again.");
    }
  }

  return (
    <main className="dashboard-shell">
      <section className="search-panel" aria-labelledby="search-title">
        <div>
          <p className="eyebrow">Near Me FC demo</p>
          <h1 id="search-title">Find football fixtures near you</h1>
          <p className="intro">
            Prototype shown with Premier League and Championship data. Built to demonstrate the fixture finder we want to extend into non-league football with partner data.
          </p>
        </div>

        <form onSubmit={onSubmit} className="search-form">
          <label>
            Postcode
            <input value={postcode} onChange={(event) => setPostcode(event.target.value)} autoComplete="postal-code" required />
          </label>
          <label>
            Radius
            <select value={radiusMiles} onChange={(event) => setRadiusMiles(event.target.value)}>
              <option value="10">10 miles</option>
              <option value="20">20 miles</option>
              <option value="50">50 miles</option>
              <option value="200">Demo wide</option>
            </select>
          </label>
          <label>
            From
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <button type="submit" disabled={state === "loading"}>
            {state === "loading" ? "Searching" : "Search"}
          </button>
        </form>
      </section>

      <section className="results-section" aria-live="polite">
        {state === "idle" && (
          <div className="empty-state">Search a postcode to see nearby fixtures, admission prices, and cached travel estimates.</div>
        )}
        {state === "error" && <div className="error-state">{error}</div>}
        {state === "ready" && (
          <>
            <div className="results-header">
              <h2>{resultCount} fixtures</h2>
              <span>Best-effort prices. Confirm with the club before travelling.</span>
            </div>
            {results.length === 0 ? (
              <div className="empty-state">No fixtures found in that radius and date range.</div>
            ) : (
              <div className="result-list">
                {results.map((result) => (
                  <article className="fixture-card" key={result.id}>
                    <div className="fixture-main">
                      <p className="competition">{result.competitionName}</p>
                      <h3>{result.title}</h3>
                      <p>{result.venueName} · {result.venuePostcode}</p>
                      <p>{formatKickoff(result.kickoffAt, result.isHistorical)}</p>
                    </div>
                    <div className="fixture-meta">
                      <strong>{formatPrice(result.price.amountPence)}</strong>
                      <span>{result.price.label}</span>
                      <span>{result.travel.distanceMiles.toFixed(1)} miles</span>
                      <span>{result.travel.drivingMinutes === null ? "Drive TBC" : `${result.travel.drivingMinutes} min drive`}</span>
                      <span>{result.travel.publicTransportMinutes === null ? "Transit TBC" : `${result.travel.publicTransportMinutes} min transit`}</span>
                    </div>
                    <div className="fixture-actions">
                      {result.genericTicketUrl && <a href={result.genericTicketUrl} target="_blank" rel="noreferrer">Club tickets</a>}
                      {result.price.sourceUrl && <a href={result.price.sourceUrl} target="_blank" rel="noreferrer">Price source</a>}
                      <button type="button" onClick={() => setCorrectionFixture(result)}>Pricing incorrect?</button>
                    </div>
                    <div className="fixture-badges">
                      {result.isHistorical && <span>Historical demo data</span>}
                      {result.isDemoData && <span>Demo fixture</span>}
                      <span>{result.price.confidence === "unknown" ? "Price unknown" : "Best-effort price"}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {correctionFixture && (
        <section className="correction-panel" aria-labelledby="correction-title">
          <h2 id="correction-title">Correct pricing for {correctionFixture.homeClub}</h2>
          <form onSubmit={submitCorrection} className="correction-form">
            <label>
              Correct pricing or note
              <textarea value={correctionText} onChange={(event) => setCorrectionText(event.target.value)} required />
            </label>
            <div className="button-row">
              <button type="submit">Submit correction</button>
              <button type="button" className="secondary-button" onClick={() => setCorrectionFixture(null)}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      {correctionStatus && <div className="toast">{correctionStatus}</div>}
    </main>
  );
}
