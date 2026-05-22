import Link from "next/link";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getDatabase } from "@/lib/db/client";
import { getSeasons, getSources } from "@/lib/admin/imports";

export const dynamic = "force-dynamic";

export default async function AdminNewImportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();
  const sp = await searchParams;

  const db = await getDatabase();
  const seasons = await getSeasons(db);
  const sources = await getSources(db);

  const error = sp.error;
  const mode = sp.mode ?? "csv";

  return (
    <main style={{ maxWidth: "48rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <meta name="csrf-token" content={csrfToken} />
      <header style={{
        padding: "1.25rem 0",
        borderBottom: "1px solid #dce3e2",
        marginBottom: "1.5rem",
      }}>
        <Link href="/admin/imports" style={{
          color: "#6f7e7a", fontSize: "13px", textDecoration: "none", fontWeight: 600
        }}>&larr; Import batches</Link>
        <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>New Import</h1>
      </header>

      {error && (
        <div style={{
          border: "1px solid #f0beb7", borderRadius: "8px",
          background: "#fde9e5", padding: "0.75rem 1rem",
          marginBottom: "1rem", color: "#a53a2d", fontSize: "14px"
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <Link href="/admin/imports/new?mode=csv" style={{
          padding: "0.5rem 1rem", borderRadius: "7px", fontSize: "14px", fontWeight: 600,
          textDecoration: "none",
          background: mode === "csv" ? "#147a4d" : "#fff",
          color: mode === "csv" ? "#fff" : "#147a4d",
          border: mode === "csv" ? "1px solid #147a4d" : "1px solid #147a4d",
        }}>CSV Paste</Link>
        <Link href="/admin/imports/new?mode=url" style={{
          padding: "0.5rem 1rem", borderRadius: "7px", fontSize: "14px", fontWeight: 600,
          textDecoration: "none",
          background: mode === "url" ? "#147a4d" : "#fff",
          color: mode === "url" ? "#fff" : "#147a4d",
          border: mode === "url" ? "1px solid #147a4d" : "1px solid #147a4d",
        }}>URL Import</Link>
      </div>

      {mode === "csv" ? (
        <form method="post" action="/api/admin/imports/preview-csv" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input type="hidden" name="csrf" value={csrfToken} />

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "14px", marginBottom: "0.25rem", color: "#17221f" }}>
              Source name
            </label>
            <input type="text" name="source_name" list="source-list" placeholder="Manual CSV Paste"
              style={{ width: "100%", padding: "0.5rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }} />
            <datalist id="source-list">
              {sources.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "14px", marginBottom: "0.25rem", color: "#17221f" }}>
              Season
            </label>
            <select name="season_label" defaultValue={seasons.find((s) => s.isCurrent)?.label ?? ""} style={{ width: "100%", padding: "0.5rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}>
              <option value="">Auto-detect</option>
              {seasons.map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label} {s.isCurrent ? "(current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "14px", marginBottom: "0.25rem", color: "#17221f" }}>
              CSV data
            </label>
            <textarea name="csv" rows={15}
              placeholder={"Home,Away,Date,Time,Competition,Venue,Price\nChelsea,Arsenal,2026-05-20,15:00,PL,Stamford Bridge,£30"}
              style={{ width: "100%", padding: "0.5rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "13px", fontFamily: "monospace" }} />
          </div>

          <button type="submit" style={{
            alignSelf: "flex-start",
            border: "1px solid #147a4d", borderRadius: "7px",
            background: "#147a4d", color: "#fff",
            padding: "0.6rem 1.5rem", fontSize: "14px", fontWeight: 700, cursor: "pointer"
          }}>
            Preview &rarr;
          </button>
        </form>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "14px", marginBottom: "0.25rem", color: "#17221f" }}>
              Fixture URL
            </label>
            <p style={{ margin: "0 0 0.5rem", fontSize: "13px", color: "#6f7e7a" }}>
              Enter the URL of a page containing fixture tables in HTML format.
            </p>
            <input type="url" name="url" id="url-input" placeholder="https://example.com/fixtures"
              style={{ width: "100%", padding: "0.5rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }} />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "14px", marginBottom: "0.25rem", color: "#17221f" }}>
              Season
            </label>
            <select name="season_label" id="url-season" defaultValue={seasons.find((s) => s.isCurrent)?.label ?? ""} style={{ width: "100%", padding: "0.5rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}>
              <option value="">Auto-detect</option>
              {seasons.map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label} {s.isCurrent ? "(current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <button type="button" id="detect-btn" style={{
            alignSelf: "flex-start",
            border: "1px solid #147a4d", borderRadius: "7px",
            background: "#147a4d", color: "#fff",
            padding: "0.6rem 1.5rem", fontSize: "14px", fontWeight: 700, cursor: "pointer"
          }}>
            Detect tables &rarr;
          </button>

          <div id="table-results" style={{ display: "none", flexDirection: "column", gap: "0.75rem" }}>
            <h3 style={{ margin: 0, fontSize: "16px" }}>Detected Tables</h3>
            <div id="table-list" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}></div>

            <form id="import-url-form" method="post" action="/api/admin/imports/create-from-url" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input type="hidden" name="csrf" value={csrfToken} />
              <input type="hidden" name="url" id="url-hidden" />
              <input type="hidden" name="selected_tables" id="selected-tables" />
              <input type="hidden" name="season_label" id="season-hidden" />

              <button type="submit" style={{
                alignSelf: "flex-start",
                border: "1px solid #147a4d", borderRadius: "7px",
                background: "#147a4d", color: "#fff",
                padding: "0.6rem 1.5rem", fontSize: "14px", fontWeight: 700, cursor: "pointer"
              }}>
                Import selected &rarr;
              </button>
            </form>
          </div>

          <div id="detect-error" style={{ display: "none", border: "1px solid #f0beb7", borderRadius: "8px", background: "#fde9e5", padding: "0.75rem 1rem", color: "#a53a2d", fontSize: "14px" }}></div>
        </div>
      )}

      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          function initUrlImport() {
            var detectBtn = document.getElementById("detect-btn");
            var urlInput = document.getElementById("url-input");
            var tableResults = document.getElementById("table-results");
            var tableList = document.getElementById("table-list");
            var detectError = document.getElementById("detect-error");
            var urlHidden = document.getElementById("url-hidden");
            var selectedTables = document.getElementById("selected-tables");
            var seasonHidden = document.getElementById("season-hidden");
            var urlSeason = document.getElementById("url-season");

            if (!detectBtn || !urlInput || !tableResults || !tableList || !detectError || !urlHidden || !selectedTables || !seasonHidden || !urlSeason) {
              return;
            }

            if (detectBtn.dataset.urlImportBound === "1") return;
            detectBtn.dataset.urlImportBound = "1";

            var originalText = detectBtn.textContent;
            var csrf = document.querySelector("meta[name=csrf-token]").content;

            detectBtn.addEventListener("click", async function() {
              var url = urlInput.value.trim();
              if (!url) { alert("Please enter a URL"); return; }

              detectBtn.disabled = true;
              detectBtn.textContent = "Detecting...";
              tableResults.style.display = "none";
              tableList.innerHTML = "";
              detectError.style.display = "none";

              try {
                var formData = new URLSearchParams();
                formData.set("url", url);
                formData.set("csrf", csrf);

                var res = await fetch("/api/admin/imports/preview-url", {
                  method: "POST",
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  body: formData.toString()
                });

                if (!res.ok) {
                  var errData = await res.json().catch(function() { return {}; });
                  showError(errData.error || "Detection failed (HTTP " + res.status + ")");
                  return;
                }

                var data = await res.json();

                if (!data.tables || data.tables.length === 0) {
                  showError("No fixture tables found in the page");
                  return;
                }

                data.tables.forEach(function(table, idx) {
                  var card = document.createElement("div");
                  card.style.cssText = "border:1px solid #dce3e2;border-radius:8px;padding:0.75rem 1rem";

                  var checkbox = document.createElement("input");
                  checkbox.type = "checkbox";
                  checkbox.checked = true;
                  checkbox.value = String(table.tableIndex);
                  checkbox.style.marginRight = "0.5rem";

                  var label = document.createElement("label");
                  label.style.cssText = "font-weight:600;font-size:14px;cursor:pointer";
                  label.textContent = "Table " + (idx + 1) + (table.caption ? ": " + table.caption : "");

                  var meta = document.createElement("div");
                  meta.style.cssText = "font-size:13px;color:#6f7e7a;margin-top:0.25rem";
                  meta.textContent = table.rowCount + " rows · " + (table.headers.length > 0 ? table.headers.join(", ") : "no headers") + " · score: " + table.score;

                  var samples = document.createElement("div");
                  samples.style.cssText = "font-size:12px;color:#6f7e7a;margin-top:0.25rem;font-family:monospace";
                  if (table.sampleCells && table.sampleCells.length > 0) {
                    samples.textContent = "Samples: " + table.sampleCells.map(function(row) {
                      return row.slice(0, 3).join(" | ");
                    }).join("  //  ");
                  }

                  var header = document.createElement("div");
                  header.style.cssText = "display:flex;align-items:center";
                  header.appendChild(checkbox);
                  header.appendChild(label);
                  card.appendChild(header);
                  card.appendChild(meta);
                  card.appendChild(samples);

                  tableList.appendChild(card);

                  checkbox.addEventListener("change", updateSelection);
                });

                urlHidden.value = url;
                updateSelection();
                tableResults.style.display = "flex";

              } catch (e) {
                showError("Failed to detect tables: " + e.message);
              } finally {
                detectBtn.disabled = false;
                detectBtn.textContent = originalText;
              }
            });

            function updateSelection() {
              var checked = [];
              document.querySelectorAll("#table-list input[type=checkbox]:checked").forEach(function(cb) {
                checked.push(cb.value);
              });
              selectedTables.value = checked.join(",");
            }

            var form = document.getElementById("import-url-form");
            if (form) {
              form.addEventListener("submit", function() {
                seasonHidden.value = urlSeason.value;
              });
            }

            function showError(msg) {
              detectError.textContent = msg;
              detectError.style.display = "block";
            }
          }

          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", initUrlImport);
          } else {
            initUrlImport();
          }
        })();
      ` }} />
    </main>
  );
}
