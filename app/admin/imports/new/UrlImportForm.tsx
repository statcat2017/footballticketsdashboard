"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { SeasonOption } from "@/lib/admin/imports";

interface DetectedTable {
  tableIndex: number;
  caption: string | null;
  headers: string[];
  rowCount: number;
  sampleCells: string[][];
  score: number;
}

interface LogEntry {
  text: string;
  type: "info" | "error" | "success";
}

export default function UrlImportForm({
  csrfToken,
  seasons,
}: {
  csrfToken: string;
  seasons: SeasonOption[];
}) {
  const [tables, setTables] = useState<DetectedTable[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [detecting, setDetecting] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const seasonRef = useRef<HTMLSelectElement>(null);

  const addLog = useCallback((text: string, type: "info" | "error" | "success" = "info") => {
    setLog((prev) => [...prev, { text, type }]);
  }, []);

  useEffect(() => {
    addLog("UrlImportForm mounted", "info");
  }, [addLog]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const handleDetect = async () => {
    const url = urlRef.current?.value.trim();
    if (!url) {
      addLog("Error: URL is empty", "error");
      return;
    }

    addLog(`Fetching ${url}...`, "info");
    setDetecting(true);
    setTables([]);
    setSelectedIndices(new Set());

    try {
      const formData = new URLSearchParams();
      formData.set("url", url);
      formData.set("csrf", csrfToken);

      const res = await fetch("/api/admin/imports/preview-url", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      addLog(`Response: HTTP ${res.status} ${res.statusText}`, res.ok ? "success" : "error");

      if (!res.ok) {
        let errData: Record<string, unknown> = {};
        try {
          errData = await res.json();
        } catch {
          // response not JSON
        }
        addLog(`Error: ${errData.error || "Detection failed"}`, "error");
        return;
      }

      const data = await res.json();

      if (!data.tables || data.tables.length === 0) {
        addLog("No fixture tables found in the page", "error");
        return;
      }

      addLog(`Found ${data.tables.length} table(s)`, "success");
      setTables(data.tables);
      setSelectedIndices(new Set(data.tables.map((t: DetectedTable) => t.tableIndex)));
    } catch (e) {
      addLog(`Failed: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setDetecting(false);
    }
  };

  const toggleTable = (tableIndex: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(tableIndex)) {
        next.delete(tableIndex);
      } else {
        next.add(tableIndex);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIndices(new Set(tables.map((t) => t.tableIndex)));
  };

  const deselectAll = () => {
    setSelectedIndices(new Set());
  };

  const currentSeason = seasons.find((s) => s.isCurrent)?.label ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <label style={{ display: "block", fontWeight: 600, fontSize: "14px", marginBottom: "0.25rem", color: "#17221f" }}>
          Fixture URL
        </label>
        <p style={{ margin: "0 0 0.5rem", fontSize: "13px", color: "#6f7e7a" }}>
          Enter the URL of a page containing fixture tables in HTML format.
        </p>
        <input
          ref={urlRef}
          type="url"
          placeholder="https://example.com/fixtures"
          style={{ width: "100%", padding: "0.5rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
        />
      </div>

      <div>
        <label style={{ display: "block", fontWeight: 600, fontSize: "14px", marginBottom: "0.25rem", color: "#17221f" }}>
          Season
        </label>
        <select
          ref={seasonRef}
          defaultValue={currentSeason}
          style={{ width: "100%", padding: "0.5rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
        >
          <option value="">Auto-detect</option>
          {seasons.map((s) => (
            <option key={s.label} value={s.label}>
              {s.label} {s.isCurrent ? "(current)" : ""}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={handleDetect}
        disabled={detecting}
        style={{
          alignSelf: "flex-start",
          border: "1px solid #147a4d",
          borderRadius: "7px",
          background: detecting ? "#6f7e7a" : "#147a4d",
          color: "#fff",
          padding: "0.6rem 1.5rem",
          fontSize: "14px",
          fontWeight: 700,
          cursor: detecting ? "not-allowed" : "pointer",
        }}
      >
        {detecting ? "Detecting..." : "Detect tables →"}
      </button>

      <div
        ref={logRef}
        style={{
          fontFamily: "monospace",
          fontSize: "12px",
          background: "#f4f7f6",
          border: "1px solid #dce3e2",
          borderRadius: "6px",
          padding: "0.5rem 0.75rem",
          maxHeight: "120px",
          overflowY: "auto",
          lineHeight: "1.6",
        }}
      >
        {log.length === 0 && (
          <span style={{ color: "#6f7e7a" }}>Activity log will appear here...</span>
        )}
        {log.map((entry, i) => (
          <div key={i} style={{ color: entry.type === "error" ? "#a53a2d" : entry.type === "success" ? "#147a4d" : "#17221f" }}>
            {entry.text}
          </div>
        ))}
      </div>

      {tables.length > 0 && (
        <div id="table-results" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: "16px" }}>Detected Tables</h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={selectAll}
                style={{
                  border: "1px solid #dce3e2",
                  borderRadius: "5px",
                  background: "#fff",
                  padding: "0.25rem 0.5rem",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={deselectAll}
                style={{
                  border: "1px solid #dce3e2",
                  borderRadius: "5px",
                  background: "#fff",
                  padding: "0.25rem 0.5rem",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Deselect all
              </button>
            </div>
          </div>

          <div id="table-list" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {tables.map((table, idx) => (
              <div
                key={table.tableIndex}
                onClick={() => toggleTable(table.tableIndex)}
                style={{
                  border: selectedIndices.has(table.tableIndex) ? "2px solid #147a4d" : "1px solid #dce3e2",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  cursor: "pointer",
                  background: selectedIndices.has(table.tableIndex) ? "#f0faf4" : "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedIndices.has(table.tableIndex)}
                    readOnly
                    style={{ marginRight: "0.5rem" }}
                  />
                  <label style={{ fontWeight: 600, fontSize: "14px", cursor: "pointer" }}>
                    Table {idx + 1}{table.caption ? ": " + table.caption : ""}
                  </label>
                </div>
                <div style={{ fontSize: "13px", color: "#6f7e7a", marginTop: "0.25rem" }}>
                  {table.rowCount} rows · {table.headers.length > 0 ? table.headers.join(", ") : "no headers"} · score: {table.score}
                </div>
                {table.sampleCells && table.sampleCells.length > 0 && (
                  <div style={{ fontSize: "12px", color: "#6f7e7a", marginTop: "0.25rem", fontFamily: "monospace" }}>
                    Samples: {table.sampleCells.map((row) => row.slice(0, 3).join(" | ")).join("  //  ")}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form method="post" action="/api/admin/imports/create-from-url" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input type="hidden" name="csrf" value={csrfToken} />
            <input type="hidden" name="url" value={urlRef.current?.value ?? ""} />
            <input type="hidden" name="selected_tables" value={Array.from(selectedIndices).join(",")} />
            <input type="hidden" name="season_label" value={seasonRef.current?.value ?? ""} />

            <button
              type="submit"
              disabled={selectedIndices.size === 0}
              style={{
                alignSelf: "flex-start",
                border: "1px solid #147a4d",
                borderRadius: "7px",
                background: selectedIndices.size === 0 ? "#6f7e7a" : "#147a4d",
                color: "#fff",
                padding: "0.6rem 1.5rem",
                fontSize: "14px",
                fontWeight: 700,
                cursor: selectedIndices.size === 0 ? "not-allowed" : "pointer",
              }}
            >
              Import selected ({selectedIndices.size}) →
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
