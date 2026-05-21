"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FixtureResult } from "@/lib/types";
import { computeDateRange } from "@/lib/date";

type SearchState = "idle" | "loading" | "ready" | "error";
type CompetitionCategory = "premier-league" | "efl" | "non-league" | "womens" | "cup" | "friendly";

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0
});

const kickoffFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London"
});

const dateGroupFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/London"
});

const dateRangeFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/London"
});

function formatMoney(pence: number | null): string {
  if (pence === null) return "TBC";
  return moneyFormatter.format(pence / 100);
}

function formatPriceLine(result: FixtureResult): string {
  if (result.price.adultPricePence === null && result.price.concessionPricePence === null) {
    return "Price not confirmed";
  }
  return `${formatMoney(result.price.adultPricePence)} conc ${formatMoney(result.price.concessionPricePence)}`;
}

function formatKickoffDate(value: string | null): string {
  if (value === null) return "Kick-off TBC";
  return kickoffFormatter.format(new Date(value));
}

function formatDateGroup(value: string | null): string {
  if (value === null) return "Date TBC";
  return dateGroupFormatter.format(new Date(value));
}

function formatDateRange(results: FixtureResult[]): string {
  const dates = results
    .map((r) => r.kickoffAt)
    .filter((v): v is string => v !== null)
    .sort();
  if (dates.length === 0) return "";
  return `${dateRangeFormatter.format(new Date(dates[0]))} - ${dateRangeFormatter.format(new Date(dates[dates.length - 1]))}`;
}

function formatVerifiedAt(value: string | null): string {
  if (value === null) return "";
  const verified = new Date(value);
  const now = new Date();
  const diffHours = Math.round((now.getTime() - verified.getTime()) / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function travelMinutes(value: number | null): string {
  return value === null ? "TBC" : `${value} min`;
}

function competitionCategory(name: string): CompetitionCategory {
  const lower = name.toLowerCase();
  if (lower.includes("premier")) return "premier-league";
  if (lower.includes("women") || lower.includes("wsl") || lower.includes("fa wsl")) return "womens";
  if (lower.includes("fa cup") || lower.includes("efl cup") || lower.includes("carabao") || lower.includes("league cup")) return "cup";
  if (lower.includes("championship") || lower.includes("league one") || lower.includes("league two") || lower.includes("efl")) return "efl";
  if (lower.includes("friendly")) return "friendly";
  return "non-league";
}

function competitionBadgeLabel(category: CompetitionCategory): string {
  switch (category) {
    case "premier-league": return "Premier League";
    case "efl": return "EFL";
    case "non-league": return "Non-league";
    case "womens": return "Women's";
    case "cup": return "Cup";
    case "friendly": return "Friendly";
  }
}

function featuredReason(result: FixtureResult, allResults: FixtureResult[]): string {
  const closest = [...allResults].sort((a, b) => a.travel.distanceMiles - b.travel.distanceMiles)[0];
  if (result.id === closest?.id) return "Closest to you";

  const cheapest = [...allResults]
    .filter((r) => r.price.adultPricePence !== null)
    .sort((a, b) => (a.price.adultPricePence ?? Infinity) - (b.price.adultPricePence ?? Infinity))[0];
  if (result.id === cheapest?.id) return "Best value";

  const fastest = [...allResults]
    .filter((r) => r.travel.drivingMinutes !== null)
    .sort((a, b) => (a.travel.drivingMinutes ?? Infinity) - (b.travel.drivingMinutes ?? Infinity))[0];
  if (result.id === fastest?.id) return "Shortest journey";

  const category = competitionCategory(result.competitionName);
  if (category === "premier-league") return "Top-flight match";

  return "Recommended";
}

export function SearchDashboard({ showAdminLink = false }: { showAdminLink?: boolean }) {
  const [postcode, setPostcode] = useState("SE20 7RS");
  const [state, setState] = useState<SearchState>("idle");
  const [error, setError] = useState("");
  const [results, setResults] = useState<FixtureResult[]>([]);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "failed">("idle");
  const [visibleCount, setVisibleCount] = useState(12);
  const [sortKey, setSortKey] = useState<"distance" | "kickoff" | "admission" | "travel">("distance");
  const [dateFilter, setDateFilter] = useState<"this-weekend" | "next-weekend" | "all-upcoming">("this-weekend");
  const [compFilter, setCompFilter] = useState<CompetitionCategory | "all">("all");
  const [travelFilter, setTravelFilter] = useState<"all" | "under30" | "under60">("all");
  const abortRef = useRef<AbortController | null>(null);

  const filteredResults = useMemo(() => {
    let filtered = [...results];
    if (compFilter !== "all") {
      filtered = filtered.filter((r) => competitionCategory(r.competitionName) === compFilter);
    }
    if (travelFilter === "under30") {
      filtered = filtered.filter((r) => r.travel.drivingMinutes !== null && r.travel.drivingMinutes <= 30);
    } else if (travelFilter === "under60") {
      filtered = filtered.filter((r) => r.travel.drivingMinutes !== null && r.travel.drivingMinutes <= 60);
    }
    return filtered;
  }, [results, compFilter, travelFilter]);

  const sortedResults = useMemo(() => {
    const sorted = [...filteredResults];
    sorted.sort((a, b) => {
      if (sortKey === "distance") return a.travel.distanceMiles - b.travel.distanceMiles;
      if (sortKey === "kickoff") return (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? "");
      if (sortKey === "admission") {
        const aVal = a.price.adultPricePence ?? Number.MAX_SAFE_INTEGER;
        const bVal = b.price.adultPricePence ?? Number.MAX_SAFE_INTEGER;
        return aVal - bVal;
      }
      if (sortKey === "travel") {
        const aVal = a.travel.drivingMinutes ?? Number.MAX_SAFE_INTEGER;
        const bVal = b.travel.drivingMinutes ?? Number.MAX_SAFE_INTEGER;
        return aVal - bVal;
      }
      return 0;
    });
    return sorted;
  }, [filteredResults, sortKey]);

  const resultCount = sortedResults.length;
  const featuredFixture = sortedResults.length > 0 ? sortedResults[0] : null;

  const groupedResults = useMemo(() => {
    const visible = sortedResults.slice(0, visibleCount);
    const groups = new Map<string, { label: string; items: FixtureResult[] }>();
    for (const result of visible) {
      const dateKey = result.fixtureDate ?? result.kickoffAt?.slice(0, 10) ?? "unknown";
      const label = formatDateGroup(result.kickoffAt);
      if (!groups.has(dateKey)) {
        groups.set(dateKey, { label, items: [] });
      }
      groups.get(dateKey)!.items.push(result);
    }
    return groups;
  }, [sortedResults, visibleCount]);

  const dateRange = useMemo(() => formatDateRange(sortedResults), [sortedResults]);
  const remainingCount = sortedResults.length - visibleCount;

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
      setVisibleCount(12);
      setState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError("Network error — check your connection.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void runSearch(postcode, computeDateRange(dateFilter));
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSearch]);

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
          {showAdminLink && <a href="/admin">Admin</a>}
          <a href="#" className="active">Fixtures</a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/divisions">Divisions</a>
          <a href="/pyramid">Pyramid</a>
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
          <button className={`pill ${dateFilter === "all-upcoming" ? "active" : ""}`} type="button" disabled={state === "loading"} onClick={() => { setDateFilter("all-upcoming"); void runSearch(postcode, computeDateRange("all-upcoming")); }}>All dates</button>
        </div>
      </form>

      <main className="results" aria-live="polite">
        {state === "ready" && (
          <div className="meta-row">
            <div><strong>{resultCount} fixtures</strong> near {postcode}{dateRange ? ` · ${dateRange}` : ""}</div>
            <div className="meta-controls">
              <select className="filter-select" aria-label="Competition filter" value={compFilter} onChange={(event) => setCompFilter(event.target.value as typeof compFilter)}>
                <option value="all">All competitions</option>
                <option value="premier-league">Premier League</option>
                <option value="efl">EFL</option>
                <option value="non-league">Non-league</option>
                <option value="womens">Women&apos;s</option>
                <option value="cup">Cup</option>
                <option value="friendly">Friendly</option>
              </select>
              <select className="filter-select" aria-label="Travel time filter" value={travelFilter} onChange={(event) => setTravelFilter(event.target.value as typeof travelFilter)}>
                <option value="all">Any travel time</option>
                <option value="under30">Under 30 min</option>
                <option value="under60">Under 60 min</option>
              </select>
              <select className="sort-select" aria-label="Sort fixtures" value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)}>
                <option value="distance">Sort by distance</option>
                <option value="travel">Sort by travel time</option>
                <option value="kickoff">Sort by kick-off</option>
                <option value="admission">Sort by admission</option>
              </select>
            </div>
          </div>
        )}

        {state === "loading" && (
          <div className="state-panel">
            <strong>Finding nearby fixtures</strong>
            <span>Checking fixtures for the selected date range.</span>
          </div>
        )}

        {state === "error" && (
          <div className="state-panel error-state">
            <strong>{error}</strong>
            <span>Try a UK postcode or one of the ground postcodes in the demo data.</span>
          </div>
        )}

        {state === "ready" && sortedResults.length === 0 && (
          <div className="state-panel">
            <strong>No fixtures found for the selected filters.</strong>
            <span>Try expanding your filters or changing the date range.</span>
          </div>
        )}

        {state === "ready" && featuredFixture && (
          <section className="featured" aria-label="Featured fixture">
            <div>
              <span className="featured-badge">Featured</span>
              <span className="featured-reason">{featuredReason(featuredFixture, sortedResults)}</span>
              <h1>{featuredFixture.title}</h1>
              <p className="featured-meta">
                <CompetitionBadge category={competitionCategory(featuredFixture.competitionName)} />
                {" "}{featuredFixture.venueName}{featuredFixture.venuePostcode ? `, ${featuredFixture.venuePostcode}` : ""} · {formatKickoffDate(featuredFixture.kickoffAt)}
              </p>
              <p className="featured-travel">
                <span className="chip"><CarIcon /> Drive {travelMinutes(featuredFixture.travel.drivingMinutes)}</span>
                {featuredFixture.travel.publicTransportMinutes !== null && (
                  <span className="chip"><TrainIcon /> Transit {travelMinutes(featuredFixture.travel.publicTransportMinutes)}</span>
                )}
                <span className="featured-distance">{featuredFixture.travel.distanceMiles.toFixed(1)} miles away</span>
              </p>
              {featuredFixture.price.verifiedAt && (
                <p className="trust-line">Last checked {formatVerifiedAt(featuredFixture.price.verifiedAt)}{featuredFixture.price.sourceUrl ? ` · Source: club website` : ""}</p>
              )}
            </div>
            <div className="featured-actions">
              {featuredFixture.genericTicketUrl ? (
                <a className="ticket-button" href={featuredFixture.genericTicketUrl} target="_blank" rel="noreferrer">Get tickets</a>
              ) : (
                <a className="ticket-button" href={featuredFixture.officialSiteUrl ?? "#"} target="_blank" rel="noreferrer">View match details</a>
              )}
            </div>
          </section>
        )}

        {/* Desktop table */}
        {state === "ready" && (
          <section className="fixtures desktop-table" aria-label="Fixture list">
            <div className="grid-row grid-header">
              <div>Match</div>
              <div>Competition</div>
              <div>Venue</div>
              <div>Admission</div>
              <div>Travel time</div>
              <div></div>
            </div>

            {Array.from(groupedResults.entries()).map(([dateKey, group]) => {
              if (group.items.length === 0) return null;

              return (
                <div className="date-group" key={dateKey}>
                  <div className="date-group-header">{group.label}</div>
                  {group.items.map((result) => {
                    const compCat = competitionCategory(result.competitionName);

                    return (
                      <article className="grid-row fixture-row" key={result.id}>
                        <div>
                          <div className="primary">{result.title}</div>
                          <div className="secondary">{formatKickoffDate(result.kickoffAt)}</div>
                        </div>
                        <div>
                          <CompetitionBadge category={compCat} />
                        </div>
                        <div>
                          <div>{result.venueName}</div>
                          <div className="secondary">{result.venuePostcode} · {result.travel.distanceMiles.toFixed(1)} miles</div>
                        </div>
                        <div>
                          <span className="badge check-club">Check club for availability</span>
                          <div className="secondary">{formatPriceLine(result)}</div>
                          {result.price.verifiedAt && (
                            <div className="secondary trust-line">Checked {formatVerifiedAt(result.price.verifiedAt)}</div>
                          )}
                        </div>
                        <div className="travel-chips">
                          <span className="chip">
                            <CarIcon />
                            Drive {travelMinutes(result.travel.drivingMinutes)}
                          </span>
                          {result.travel.publicTransportUrl ? (
                            <a className="chip chip-link" href={result.travel.publicTransportUrl} target="_blank" rel="noreferrer">
                              <TrainIcon />
                              Transit {travelMinutes(result.travel.publicTransportMinutes)}
                            </a>
                          ) : (
                            <span className="chip">
                              <TrainIcon />
                              Transit {travelMinutes(result.travel.publicTransportMinutes)}
                            </span>
                          )}
                        </div>
                        <div className="row-action">
                          {result.genericTicketUrl ? (
                            <a className="view-link" href={result.genericTicketUrl} target="_blank" rel="noreferrer">Tickets</a>
                          ) : result.officialSiteUrl ? (
                            <a className="view-link" href={result.officialSiteUrl} target="_blank" rel="noreferrer">View</a>
                          ) : (
                            <span className="view-link view-placeholder">Details</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              );
            })}

            {visibleCount < sortedResults.length && (
              <button className="show-more" type="button" onClick={() => setVisibleCount((prev) => prev + 12)}>
                Show {Math.min(12, remainingCount)} more of {sortedResults.length} fixtures
              </button>
            )}
          </section>
        )}

        {/* Mobile cards */}
        {state === "ready" && (
          <section className="fixtures mobile-cards" aria-label="Fixture list">
            {Array.from(groupedResults.entries()).map(([dateKey, group]) => {
              if (group.items.length === 0) return null;

              return (
                <div className="date-group" key={dateKey}>
                  <div className="date-group-header">{group.label}</div>
                  {group.items.map((result) => {
                    const compCat = competitionCategory(result.competitionName);

                    return (
                      <article className="fixture-card" key={result.id}>
                        <div className="fixture-card-header">
                          <CompetitionBadge category={compCat} />
                          <span className="fixture-card-distance">{result.travel.distanceMiles.toFixed(1)} mi</span>
                        </div>
                        <h3 className="fixture-card-title">{result.title}</h3>
                        <p className="fixture-card-meta">{formatKickoffDate(result.kickoffAt)}</p>
                        <p className="fixture-card-venue">{result.venueName}{result.venuePostcode ? `, ${result.venuePostcode}` : ""}</p>
                        <div className="fixture-card-travel">
                          <span className="chip"><CarIcon /> Drive {travelMinutes(result.travel.drivingMinutes)}</span>
                          {result.travel.publicTransportUrl ? (
                            <a className="chip chip-link" href={result.travel.publicTransportUrl} target="_blank" rel="noreferrer">
                              <TrainIcon /> Transit {travelMinutes(result.travel.publicTransportMinutes)}
                            </a>
                          ) : (
                            <span className="chip"><TrainIcon /> Transit {travelMinutes(result.travel.publicTransportMinutes)}</span>
                          )}
                        </div>
                        <div className="fixture-card-footer">
                          <span className="badge check-club">Check club for availability</span>
                          <span className="fixture-card-price">{formatPriceLine(result)}</span>
                        </div>
                        {result.genericTicketUrl ? (
                          <a className="fixture-card-action" href={result.genericTicketUrl} target="_blank" rel="noreferrer">Get tickets</a>
                        ) : result.officialSiteUrl ? (
                          <a className="fixture-card-action" href={result.officialSiteUrl} target="_blank" rel="noreferrer">View details</a>
                        ) : (
                          <span className="fixture-card-action fixture-card-action-placeholder">View details</span>
                        )}
                        {result.price.verifiedAt && (
                          <p className="trust-line card-trust">Checked {formatVerifiedAt(result.price.verifiedAt)}</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              );
            })}

            {visibleCount < sortedResults.length && (
              <button className="show-more" type="button" onClick={() => setVisibleCount((prev) => prev + 12)}>
                Show {Math.min(12, remainingCount)} more of {sortedResults.length} fixtures
              </button>
            )}
          </section>
        )}

        <footer className="footer-strip">
          <span>Pricing incorrect or missing?</span>
          <a href="mailto:hello@nearme.fc">Report wrong information</a>
        </footer>
      </main>
    </>
  );
}

function CompetitionBadge({ category }: { category: CompetitionCategory }) {
  return (
    <span className={`comp-badge comp-${category}`}>
      {competitionBadgeLabel(category)}
    </span>
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
