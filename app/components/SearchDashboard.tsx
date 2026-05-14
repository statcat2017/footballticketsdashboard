"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FixtureResult } from "@/lib/types";
import { computeDateRange } from "@/lib/date";

type SearchState = "idle" | "loading" | "ready" | "error";
type Availability = "available" | "limited" | "check-club";

function formatMoney(pence: number | null): string {
  if (pence === null) {
    return "TBC";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(pence / 100);
}

function formatPriceLine(result: FixtureResult): string {
  if (result.price.adultPricePence === null && result.price.concessionPricePence === null) {
    return "price TBC";
  }

  return `${formatMoney(result.price.adultPricePence)} conc ${formatMoney(result.price.concessionPricePence)}`;
}

function formatKickoffDate(value: string | null): string {
  if (value === null) {
    return "Kick-off TBC";
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London"
  }).format(new Date(value));
}

function formatDateRange(results: FixtureResult[]): string {
  const dates = results
    .map((result) => result.kickoffAt)
    .filter((value): value is string => value !== null)
    .sort();

  if (dates.length === 0) {
    return "Next 10 days";
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London"
  });

  return `${formatter.format(new Date(dates[0]))} - ${formatter.format(new Date(dates[dates.length - 1]))}`;
}

function availability(result: FixtureResult): { label: string; tone: Availability } {
  if (result.price.saleMode === null || result.price.confidence === "unknown") {
    return { label: "Check club", tone: "check-club" };
  }

  if (result.price.saleMode === "pay_on_gate") {
    return { label: "Pay on gate", tone: "limited" };
  }

  return { label: "All ticket", tone: "available" };
}

function travelMinutes(value: number | null): string {
  return value === null ? "TBC" : `${value} min`;
}

export function SearchDashboard() {
  const [postcode, setPostcode] = useState("SE20 7RS");
  const [state, setState] = useState<SearchState>("idle");
  const [error, setError] = useState("");
  const [results, setResults] = useState<FixtureResult[]>([]);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "failed">("idle");
  const [visibleCount, setVisibleCount] = useState(12);
  const [sortKey, setSortKey] = useState<"distance" | "kickoff" | "admission">("distance");
  const [dateFilter, setDateFilter] = useState<"this-weekend" | "next-weekend" | "all-upcoming">("all-upcoming");
  const abortRef = useRef<AbortController | null>(null);

  const sortedResults = useMemo(() => {
    const sorted = [...results];
    sorted.sort((a, b) => {
      if (sortKey === "distance") {
        return a.travel.distanceMiles - b.travel.distanceMiles;
      }
      if (sortKey === "kickoff") {
        return (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? "");
      }
      if (sortKey === "admission") {
        const aVal = a.price.adultPricePence ?? Number.MAX_SAFE_INTEGER;
        const bVal = b.price.adultPricePence ?? Number.MAX_SAFE_INTEGER;
        return aVal - bVal;
      }
      return 0;
    });
    return sorted;
  }, [results, sortKey]);

  const resultCount = sortedResults.length;
  const featuredFixture = sortedResults[0] ?? null;
  const visibleResults = useMemo(() => sortedResults.slice(0, visibleCount), [sortedResults, visibleCount]);
  const dateRange = useMemo(() => formatDateRange(sortedResults), [sortedResults]);

  const runSearch = useCallback(async (searchPostcode: string, options?: { dateFrom?: string; dateTo?: string }) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setState("loading");
    setError("");

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postcode: searchPostcode,
          dateFrom: options?.dateFrom,
          dateTo: options?.dateTo
        }),
        signal: abortRef.current.signal
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Search failed.");
        setState("error");
        return;
      }

      setResults(payload.results);
      setState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setError("Network error — check your connection.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void runSearch(postcode);
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSearch]);

  useEffect(() => {
    setVisibleCount(12);
  }, [results]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch(postcode, computeDateRange(dateFilter));
  }

  async function handleLocate() {
    setGeoState("locating");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      const { latitude, longitude } = position.coords;
      // postcodes.io is a free public API (no key required). Could be routed through a server proxy
      // if a configured base URL is needed later, but direct client-side use is acceptable for the MVP.
      const res = await fetch(`https://api.postcodes.io/postcodes?latitude=${latitude}&longitude=${longitude}`);
      const data = await res.json();
      const pc: string | undefined = data.result?.[0]?.postcode;
      if (!pc) throw new Error("No postcode found");
      setPostcode(pc);
      setGeoState("idle");
      await runSearch(pc, computeDateRange(dateFilter));
    } catch {
      setGeoState("failed");
      setError("Could not determine your location. Enable location services or type a postcode.");
      setState("error");
    }
  }

  return (
    <>
      <nav className="top-nav" aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>nearme.fc</span>
        </div>
        <div className="nav-links">
          <a href="#" className="active">Fixtures</a>
          <a href="#">Grounds</a>
          <a href="#">About</a>
          <a href="#">Contact</a>
        </div>
      </nav>

      <form className="search-bar" aria-label="Fixture search" onSubmit={onSubmit}>
        <label className="postcode-field">
          <MapPinIcon className="field-icon" />
          <input
            type="text"
            value={postcode}
            onChange={(event) => setPostcode(event.target.value)}
            aria-label="Postcode"
            autoComplete="postal-code"
            required
          />
        </label>
        <button className="locate-button" type="button" onClick={handleLocate} disabled={state === "loading" || geoState === "locating"}>
          <LocateIcon />
          {geoState === "locating" ? "Locating..." : "Locate me"}
        </button>
        <div className="divider" aria-hidden="true" />
        <div className="filters" aria-label="Date filters">
          <button className={`pill ${dateFilter === "this-weekend" ? "active" : ""}`} type="button" disabled={state === "loading"} onClick={() => { setDateFilter("this-weekend"); void runSearch(postcode, computeDateRange("this-weekend")); }}>This weekend</button>
          <button className={`pill ${dateFilter === "next-weekend" ? "active" : ""}`} type="button" disabled={state === "loading"} onClick={() => { setDateFilter("next-weekend"); void runSearch(postcode, computeDateRange("next-weekend")); }}>Next weekend</button>
          <button className={`pill ${dateFilter === "all-upcoming" ? "active" : ""}`} type="button" disabled={state === "loading"} onClick={() => { setDateFilter("all-upcoming"); void runSearch(postcode, computeDateRange("all-upcoming")); }}>All upcoming</button>
        </div>
      </form>

      <main className="results" aria-live="polite">
        {state === "ready" && (
          <div className="meta-row">
            <div><strong>{resultCount} fixtures</strong> within reach · {dateRange}</div>
            <select className="sort-select" aria-label="Sort fixtures" value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)}>
              <option value="distance">Sort by distance</option>
              <option value="kickoff">Sort by kick-off</option>
              <option value="admission">Sort by admission</option>
            </select>
          </div>
        )}

        {state === "loading" && (
          <div className="state-panel">
            <strong>Finding nearby fixtures</strong>
            <span>Checking Premier League and Championship fixtures in the next 10 days.</span>
          </div>
        )}

        {state === "error" && (
          <div className="state-panel error-state">
            <strong>{error}</strong>
            <span>Try a UK postcode or one of the ground postcodes in the demo data.</span>
          </div>
        )}

        {state === "ready" && results.length === 0 && (
          <div className="state-panel">
            <strong>No fixtures found in the next 10 days.</strong>
            <span>Try a different postcode, expand your search to &quot;All upcoming&quot;, or check back later for new fixtures.</span>
          </div>
        )}

        {state === "ready" && featuredFixture && (
          <section className="featured" aria-label="Featured fixture">
            <div>
              <span className="featured-badge">Featured</span>
              <h1>{featuredFixture.title}</h1>
              <p>
                {featuredFixture.competitionName} · {featuredFixture.venueName} · {formatKickoffDate(featuredFixture.kickoffAt)} · {featuredFixture.travel.distanceMiles.toFixed(1)} miles from {postcode}
              </p>
            </div>
            {featuredFixture.genericTicketUrl ? (
              <a className="ticket-button" href={featuredFixture.genericTicketUrl} target="_blank" rel="noreferrer">Get tickets</a>
            ) : (
              <button className="ticket-button" type="button">Get tickets</button>
            )}
          </section>
        )}

        {state === "ready" && (
          <section className="fixtures" aria-label="Fixture list">
            <div className="grid-row grid-header">
              <div>Match</div>
              <div>Competition</div>
              <div>Venue</div>
              <div>Admission</div>
              <div>Travel from you</div>
            </div>

            {visibleResults.map((result) => {
              const ticketState = availability(result);

              return (
                <article className="grid-row fixture-row" key={result.id}>
                  <div>
                    <div className="primary">{result.title}</div>
                    <div className="secondary">{formatKickoffDate(result.kickoffAt)}</div>
                  </div>
                  <div>{result.competitionName}</div>
                  <div>
                    <div>{result.venueName}</div>
                    <div className="secondary">{result.travel.distanceMiles.toFixed(1)} miles</div>
                  </div>
                  <div>
                    <span className={`badge ${ticketState.tone}`}>{ticketState.label}</span>
                    <div className="secondary">{formatPriceLine(result)}</div>
                  </div>
                  <div className="travel-chips">
                    <span className="chip">
                      <CarIcon />
                      {travelMinutes(result.travel.drivingMinutes)}
                    </span>
                    {result.travel.publicTransportUrl ? (
                      <a className="chip chip-link" href={result.travel.publicTransportUrl} target="_blank" rel="noreferrer">
                        <TrainIcon />
                        Google Maps
                      </a>
                    ) : (
                      <span className="chip">
                        <TrainIcon />
                        {travelMinutes(result.travel.publicTransportMinutes)}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}

            {visibleCount < sortedResults.length && (
              <button className="show-more" type="button" onClick={() => setVisibleCount((prev) => prev + 12)}>Show more fixtures</button>
            )}
          </section>
        )}

        <footer className="footer-strip">
          <span>Pricing incorrect or missing?</span>
          <a href="mailto:hello@nearme.fc">Let us know</a>
        </footer>
      </main>
    </>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function LocateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 11h14l-2-5H7l-2 5Z" />
      <path d="M5 11v6" />
      <path d="M19 11v6" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

function TrainIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="6" y="3" width="12" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="m9 17-2 4" />
      <path d="m15 17 2 4" />
      <path d="M8 8h8" />
    </svg>
  );
}
