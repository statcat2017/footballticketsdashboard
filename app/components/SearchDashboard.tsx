"use client";

import { FormEvent, useMemo, useState } from "react";

import type { RankedTicketResult } from "@/lib/types";

type SearchState = "idle" | "loading" | "ready" | "error";

function formatPrice(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(pence / 100);
}

function formatKickoff(value: string): string {
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
  const [results, setResults] = useState<RankedTicketResult[]>([]);

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
          <p className="eyebrow">UK football tickets</p>
          <h1 id="search-title">Find nearby match tickets</h1>
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
          <div className="empty-state">Search with your postcode and age to rank available tickets.</div>
        )}
        {state === "error" && <div className="error-state">{error}</div>}
        {state === "ready" && (
          <>
            <div className="results-header">
              <h2>{resultCount} ranked results</h2>
              <span>Seed data adapter</span>
            </div>
            <div className="result-list">
              {results.map((result) => (
                <article className="ticket-card" key={result.id}>
                  <div className="ticket-main">
                    <p className="competition">{result.competition}</p>
                    <h3>
                      {result.homeTeam} vs {result.awayTeam}
                    </h3>
                    <p>
                      {result.venue} · {formatKickoff(result.kickoff)}
                    </p>
                  </div>
                  <div className="ticket-meta">
                    <strong>{formatPrice(result.effectivePricePence)}</strong>
                    {result.effectivePricePence < result.pricePence && (
                      <span className="saving">Concession from {formatPrice(result.pricePence)}</span>
                    )}
                    <a href={result.url} target="_blank" rel="noreferrer">
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
          </>
        )}
      </section>
    </main>
  );
}
