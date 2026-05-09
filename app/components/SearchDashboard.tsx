"use client";

import { FormEvent, useMemo, useState } from "react";

import type { RankedTicketOpportunityResult } from "@/lib/types";

type SearchState = "idle" | "loading" | "ready" | "error";

function formatPrice(pence: number | null): string {
  if (pence === null) {
    return "Price TBC";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(pence / 100);
}

function formatKickoff(value: string | null): string {
  if (value === null) {
    return "Kickoff TBC";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London"
  }).format(new Date(value));
}

export function SearchDashboard() {
  const [postcode, setPostcode] = useState("M16 0RA");
  const [age, setAge] = useState("65");
  const [state, setState] = useState<SearchState>("idle");
  const [error, setError] = useState("");
  const [results, setResults] = useState<RankedTicketOpportunityResult[]>([]);

  const resultCount = useMemo(() => results.length, [results]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setError("");

    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcode, age: Number(age) })
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

  return (
    <main className="dashboard-shell">
      <section className="search-panel" aria-labelledby="search-title">
        <div>
          <p className="eyebrow">UK football ticket opportunities</p>
          <h1 id="search-title">Find nearby match ticket leads</h1>
        </div>

        <form onSubmit={onSubmit} className="search-form">
          <label>
            Postcode
            <input
              value={postcode}
              onChange={(event) => setPostcode(event.target.value)}
              autoComplete="postal-code"
              required
            />
          </label>
          <label>
            Age
            <input
              type="number"
              min="0"
              max="120"
              value={age}
              onChange={(event) => setAge(event.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={state === "loading"}>
            {state === "loading" ? "Searching" : "Search"}
          </button>
        </form>
      </section>

      <section className="results-section" aria-live="polite">
        {state === "idle" && (
          <div className="empty-state">Search with your postcode and age to rank public ticket opportunities.</div>
        )}
        {state === "error" && <div className="error-state">{error}</div>}
        {state === "ready" && (
          <>
            <div className="results-header">
              <h2>{resultCount} opportunity results</h2>
              <span>Dulwich Hamlet official adapter</span>
            </div>
            {results.length === 0 ? (
              <div className="empty-state">No public ticket opportunities found from the current live sources.</div>
            ) : (
              <div className="result-list">
                {results.map((result) => (
                <article className="ticket-card" key={result.id}>
                  <div className="ticket-main">
                    <p className="competition">{result.competition ?? result.saleLabel}</p>
                    <h3>{result.title}</h3>
                    <p>
                      {result.venueName ?? "Venue TBC"} · {formatKickoff(result.kickoffAt)}
                    </p>
                  </div>
                  <div className="ticket-meta">
                    <strong>{formatPrice(result.displayPricePence)}</strong>
                    <span className="saving">{result.displayPriceLabel}</span>
                    <span>{result.saleLabel}</span>
                    <a href={result.purchaseUrl ?? result.infoUrl} target="_blank" rel="noreferrer">
                      View source
                    </a>
                  </div>
                  <div className="ticket-reasons">
                    {result.rankingReasons.map((reason) => (
                      <span key={reason}>{reason}</span>
                    ))}
                  </div>
                </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
