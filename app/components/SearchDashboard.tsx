"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { FixtureResult } from "@/lib/types";

type SearchState = "idle" | "loading" | "ready" | "error";
type Availability = "available" | "sold-out" | "limited" | "check-club";

const groundPostcodes = [
  "N5 1BU", "B6 6HE", "BH7 7AF", "TW8 0RU", "BN1 9BL", "BB10 4BX", "SW6 1HS", "SE25 6PU",
  "L5 9SR", "SW6 6HH", "LS11 0ES", "L4 0TH", "M11 3FF", "M16 0RA", "NE1 4ST", "NG2 5FJ",
  "SR5 1SU", "N17 0BX", "E20 2ST", "WV1 4QR", "BB2 4JF", "NR1 1JE", "W12 7PJ", "ST4 4EG",
  "SA1 2FA", "B71 4LF", "HU3 6HU", "PO4 8RA", "B9 4RL", "LE2 7FL", "SO14 5FP", "DE24 8XL",
  "TS3 6RS", "S6 1SW", "WD18 0ER", "SE7 8BL", "IP1 2DA", "S2 4SU", "SE16 3LN", "BS3 2EJ",
  "LL11 2AH", "CV6 6GE", "PR1 6RU", "OX4 4XP"
];

function randomGroundPostcode(): string {
  return groundPostcodes[Math.floor(Math.random() * groundPostcodes.length)] ?? "SE20 7RS";
}

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
  const [geoError, setGeoError] = useState("");
  const [results, setResults] = useState<FixtureResult[]>([]);
  const [activeFilter, setActiveFilter] = useState<"this_weekend" | "next_weekend" | "all_upcoming">("all_upcoming");
  const [activeSort, setActiveSort] = useState<"distance" | "kickoff" | "admission">("distance");
  const [visibleCount, setVisibleCount] = useState(12);

  const resultCount = results.length;
  const sortedResults = useMemo(() => {
    const sorted = [...results];
    switch (activeSort) {
      case "distance":
        sorted.sort((a, b) => a.travel.distanceMiles - b.travel.distanceMiles);
        break;
      case "kickoff":
        sorted.sort((a, b) => {
          if (a.kickoffAt === null && b.kickoffAt === null) return 0;
          if (a.kickoffAt === null) return 1;
          if (b.kickoffAt === null) return -1;
          return new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime();
        });
        break;
      case "admission":
        sorted.sort((a, b) => {
          if (a.price.adultPricePence === null && b.price.adultPricePence === null) return 0;
          if (a.price.adultPricePence === null) return 1;
          if (b.price.adultPricePence === null) return -1;
          return a.price.adultPricePence - b.price.adultPricePence;
        });
        break;
    }
    return sorted;
  }, [results, activeSort]);
  const featuredFixture = sortedResults[0] ?? null;
  const visibleResults = useMemo(() => sortedResults.slice(0, visibleCount), [sortedResults, visibleCount]);
  const dateRange = useMemo(() => formatDateRange(results), [results]);

  function formatIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  const runSearch = useCallback(async (searchPostcode: string, startDate?: string, endDate?: string) => {
    setState("loading");
    setError("");
    setGeoError("");

    try {
      const body: Record<string, unknown> = { postcode: searchPostcode };
      if (startDate) body.dateFrom = startDate;
      if (endDate) body.dateTo = endDate;
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Search failed.");
        setState("error");
        return;
      }

      setResults(payload.results);
      setVisibleCount(12);
      setState("ready");
    } catch {
      setError("Network error — check your connection.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    setPostcode(randomGroundPostcode());
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveFilter("all_upcoming");
    await runSearch(postcode);
  }

  function handleLocateMe() {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const resp = await fetch(`https://api.postcodes.io/postcodes?lon=${longitude}&lat=${latitude}`);
          const data = await resp.json();
          if (data.result && data.result.length > 0) {
            const nearestPostcode = data.result[0].postcode;
            setPostcode(nearestPostcode);
            setActiveFilter("all_upcoming");
            await runSearch(nearestPostcode);
          } else {
            setGeoError("Could not find a postcode for your location.");
          }
        } catch {
          setGeoError("Failed to look up postcode. Try entering manually.");
        }
      },
      () => {
        setGeoError("Location access denied or unavailable. Enter a postcode manually.");
      }
    );
  }

  function thisWeekendFriday(from: Date): Date {
    const d = new Date(from);
    const day = d.getDay();
    if (day >= 2 && day <= 4) {
      d.setDate(d.getDate() + (5 - day));
    } else {
      d.setDate(d.getDate() - ((day + 2) % 7));
    }
    return d;
  }

  function handleThisWeekend() {
    setActiveFilter("this_weekend");
    const today = new Date();
    const fri = thisWeekendFriday(today);
    const mon = new Date(fri);
    mon.setDate(mon.getDate() + 3);
    const start = today > fri ? today : fri;
    void runSearch(postcode, formatIsoDate(start), formatIsoDate(mon));
  }

  function handleNextWeekend() {
    setActiveFilter("next_weekend");
    const fri = thisWeekendFriday(new Date());
    fri.setDate(fri.getDate() + 7);
    const mon = new Date(fri);
    mon.setDate(mon.getDate() + 3);
    void runSearch(postcode, formatIsoDate(fri), formatIsoDate(mon));
  }

  function handleAllUpcoming() {
    setActiveFilter("all_upcoming");
    void runSearch(postcode);
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
        <button className="locate-button" type="button" onClick={handleLocateMe}>
          <LocateIcon />
          Locate me
        </button>
        {geoError && <span className="geo-error">{geoError}</span>}
        <div className="divider" aria-hidden="true" />
        <div className="filters" aria-label="Date filters">
          <button className={`pill ${activeFilter === "this_weekend" ? "active" : ""}`} type="button" onClick={handleThisWeekend} disabled={state === "loading"}>This weekend</button>
          <button className={`pill ${activeFilter === "next_weekend" ? "active" : ""}`} type="button" onClick={handleNextWeekend} disabled={state === "loading"}>Next weekend</button>
          <button className={`pill ${activeFilter === "all_upcoming" ? "active" : ""}`} type="button" onClick={handleAllUpcoming} disabled={state === "loading"}>All upcoming</button>
        </div>
      </form>

      <main className="results" aria-live="polite">
        {state === "ready" && (
          <div className="meta-row">
            <div><strong>{resultCount} fixtures</strong> within reach · {dateRange}</div>
            <select className="sort-select" aria-label="Sort fixtures" value={activeSort} onChange={(event) => setActiveSort(event.target.value as typeof activeSort)}>
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
            <span>The prototype now only shows current-window fixtures and does not fall back to historical rows.</span>
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
              <a className="ticket-button" href={featuredFixture.genericTicketUrl} target="_blank" rel="noopener noreferrer">Get tickets</a>
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
                    <span className="chip">
                      <TrainIcon />
                      {travelMinutes(result.travel.publicTransportMinutes)}
                    </span>
                  </div>
                </article>
              );
            })}

            {visibleCount < results.length && (
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
