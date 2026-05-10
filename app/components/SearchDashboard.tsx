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

  return historical ? `${formatted} · historical demo` : formatted;
}

function priceTone(confidence: FixtureResult["price"]["confidence"]): string {
  if (confidence === "unknown") {
    return "Price needs review";
  }

  if (confidence === "seed") {
    return "Best-effort club guide";
  }

  return "Club price source";
}

function formatTravel(result: FixtureResult): string {
  const drive = result.travel.drivingMinutes === null ? "Drive TBC" : `${result.travel.drivingMinutes} min drive`;
  const transit = result.travel.publicTransportMinutes === null ? "Transit TBC" : `${result.travel.publicTransportMinutes} min transit`;

  return `${result.travel.distanceMiles.toFixed(1)} miles · ${drive} · ${transit}`;
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
        <div className="search-copy">
          <p className="eyebrow">Non League Day / FWP pitch prototype</p>
          <h1 id="search-title">Find football fixtures near you</h1>
          <p className="intro">
            A credible fixture finder demo using Premier League and Championship seed data where live coverage is not yet available. It shows the experience planned for non-league expansion with partner fixtures, venues, admission guidance, and cached travel estimates.
          </p>
          <div className="demo-disclosure" role="note">
            <strong>Prototype dataset:</strong> historical/demo fixtures are clearly labelled. Prices are best-effort club-level guidance, not live availability.
          </div>
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
          <div className="state-panel">
            <p className="state-kicker">Ready to demo</p>
            <h2>Search a postcode to see the fixture rows.</h2>
            <p>Results include venue distance, cached travel estimates, admission guidance, and visible demo/historical labels so partners can see what would change when non-league data is connected.</p>
          </div>
        )}
        {state === "loading" && (
          <div className="state-panel">
            <p className="state-kicker">Searching cached demo data</p>
            <h2>Finding nearby fixtures</h2>
            <p>Checking the selected radius and date range. If live fixtures are unavailable, the demo may show labelled historical examples instead.</p>
          </div>
        )}
        {state === "error" && (
          <div className="state-panel error-state">
            <p className="state-kicker">Search could not run</p>
            <h2>{error}</h2>
            <p>Try a UK postcode district or widen the radius. The prototype should still be able to fall back to labelled demo fixtures when the search inputs are valid.</p>
          </div>
        )}
        {state === "ready" && (
          <>
            <div className="results-header">
              <div>
                <p className="state-kicker">Search results</p>
                <h2>{resultCount} fixtures</h2>
              </div>
              <p>Best-effort admission prices. Confirm fixture status, tickets, and pricing with the club before travelling.</p>
            </div>
            {results.length === 0 ? (
              <div className="state-panel">
                <p className="state-kicker">No matching fixtures</p>
                <h2>No fixtures found in that radius and date range.</h2>
                <p>Widen the radius or adjust the dates. During close-season windows the pitch demo may rely on labelled historical data rather than implying live availability.</p>
              </div>
            ) : (
              <div className="result-list">
                {results.map((result) => (
                  <article className="fixture-row" key={result.id}>
                    <div className="fixture-main">
                      <div className="fixture-badges">
                        <span>{result.competitionName}</span>
                        {result.isHistorical && <span className="warning-badge">Historical demo data</span>}
                        {result.isDemoData && <span className="warning-badge">Demo fixture</span>}
                      </div>
                      <h3>{result.title}</h3>
                      <p>{result.venueName} · {result.venuePostcode}</p>
                      <p>{formatKickoff(result.kickoffAt, result.isHistorical)}</p>
                    </div>
                    <div className="fixture-meta">
                      <div>
                        <span className="meta-label">Admission guide</span>
                        <strong>{formatPrice(result.price.amountPence)}</strong>
                        <span>{result.price.label} · {priceTone(result.price.confidence)}</span>
                      </div>
                      <div>
                        <span className="meta-label">Travel estimate</span>
                        <span>{formatTravel(result)}</span>
                      </div>
                    </div>
                    <div className="fixture-actions">
                      {result.genericTicketUrl && <a href={result.genericTicketUrl} target="_blank" rel="noreferrer">Club tickets</a>}
                      {result.price.sourceUrl && <a href={result.price.sourceUrl} target="_blank" rel="noreferrer">Price source</a>}
                      <button type="button" onClick={() => setCorrectionFixture(result)}>Pricing incorrect?</button>
                    </div>
                    {result.warnings.length > 0 && <p className="fixture-warning">{result.warnings.join(" ")}</p>}
                  </article>
                ))}
              </div>
            )}
            <aside className="prototype-note">
              <strong>Prototype for non-league expansion:</strong> the same row model can carry partner fixtures from Football Web Pages or Non League Day sources once licensing and ingestion are agreed.
            </aside>
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
