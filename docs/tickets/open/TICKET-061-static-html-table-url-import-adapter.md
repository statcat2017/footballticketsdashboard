# TICKET-061: Static HTML Table URL Import Adapter

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-059

## Purpose

Let admins enter a URL to a static fixture page, detect all HTML tables, select one or more, and import the rows into a normalized import batch.

## Work

### Safe Fetch

- Add `lib/import/adapters/htmlTable.ts`:
  - `fetchPage(url: string): Promise<string>` with safety rules:
    - only `http://` and `https://` URLs
    - reject URLs containing credentials (`https://user:pass@example.com`)
    - reject `localhost`, `127.0.0.1`, `[::1]`, private IPv4 ranges (`10.x`, `172.16-31.x`, `192.168.x`), link-local ranges (`169.254.x`), metadata hosts (`169.254.169.254`), and IPv6 loopback/private/link-local ranges
    - revalidate every redirect target with the same URL and network rules; cap redirects at 3
    - timeout cap: 15 seconds
    - response size cap: 2 MB
    - content type must contain `text/html`
    - do not execute JavaScript — static HTML only
  - Return raw HTML string on success.
  - On failure, return a structured error (timeout, size, blocked network, redirect blocked, non-HTML content).

### Table Detection & Scoring

- `extractTables(html: string): DetectedTable[]`
- Parse `<table>` elements from static HTML (use a server-safe HTML parser like `node-html-parser` or regex-based structural extraction).
- For each table, extract:
  - `tableIndex`: 0-based position in the document
  - `caption`: `<caption>` text or nearest preceding heading (`<h1>`–`<h6>`, `<th>` scope)
  - `headers`: first row cell texts
  - `rowCount`: number of data rows (excluding header row)
  - `sampleCells`: first 3 rows of cell text for admin preview
- Score each table for fixture-likeness:
  - Keywords in headers: team/home/away/date/time/kickoff/venue/ground/competition
  - Column count between 3 and 10
  - At least one date-like column pattern
  - At least one team-name column pattern
  - Score is a confidence indicator, not a gate. Show all tables, ordered by score, with scores visible in the admin picker.

### Row Parsing

- `parseTableRows(table: DetectedTable, tableIndex: number, sourceUrl: string, columnMapping?: ColumnMapping): NormalizedFixtureRow[]`
- Auto-map columns using same header detection as CSV adapter.
- Strip HTML tags from cell contents.
- Preserve original cell text in `evidence_json` alongside table index, caption, and row index.
- Combine with CSV adapter's shared parsing utilities where possible (date parsing, team name extraction).

### Multi-Table Selection

- Accept a list of `tableIndex` values from the admin.
- All selected tables contribute to one import batch.
- Store `evidence_json` per row: `{ source_url, table_index, table_caption, row_index, original_cells, mapped_headers }`.

### Batch Creation

- `createImportBatchFromHtmlUrl(db, url, sourceId, seasonLabel, actor, selectedTableIndices, columnMapping?)` — fetch, parse selected tables, create batch, insert rows.
- Store URL as batch source and in each row's `evidence_json`.
- Create or look up a `fixture_sources` row by the URL's base origin.

## Acceptance Criteria

- Admin enters a fixture page URL → adapter fetches safely and lists detected tables.
- Each table shows caption, row count, detected columns, and fixture-likeness score.
- Admin selects one or more tables → adapter creates an import batch with normalized rows.
- Rows include evidence: source URL, table index, caption, row index, original cells.
- HTML adapter and CSV adapter produce the same `NormalizedFixtureRow` structure.
- Unsafe URLs are rejected before fetch.
- Fetch failures return structured errors (timeout, size, blocked, redirect blocked, non-HTML).
- If no plausible fixture tables are found, show clear failure and allow CSV paste fallback.

## Verification

- Unit tests for URL safety validation (whitelist, blocklist, edge cases).
- Unit tests for HTML table extraction with various table structures.
- Unit tests for table scoring and header auto-mapping.
- Unit tests for row parsing with HTML cell content.
- Integration test: fetch, detect, select, parse, create batch.
- `npm run lint`
- `npm run test`
- `npm run build`

## Links

- Sprint: [docs/sprints/sprint-002.md](../../sprints/sprint-002.md)
- Foundation service: [TICKET-059](./TICKET-059-fixture-import-foundation-service.md)
- CSV adapter: [TICKET-060](./TICKET-060-csv-paste-import-adapter.md)
