import type { FixtureAdapterParseError, FixtureSourceAdapter, NormalizedFixtureRow, KickoffAssumptionPolicy } from "../types.ts";
import { createBatch, addBatchRows, updateBatchCounts, updateBatchStatus } from "../importBatch.ts";
import { getOrCreateSource } from "../sourceRegistry.ts";
import { HEADER_ALIASES, parseDateField, parseTimeField, parseStatusField, parsePriceField } from "./csv.ts";

export interface DetectedTable {
  tableIndex: number;
  caption: string | null;
  headers: string[];
  rows: string[][];
  rowCount: number;
  sampleCells: string[][];
  score: number;
}

export type HtmlRowParseError = FixtureAdapterParseError;

export interface HtmlRowsResult {
  rows: NormalizedFixtureRow[];
  errors: HtmlRowParseError[];
}

export interface HtmlTableParseOptions {
  sourceUrl?: string;
  selectedTableIndices?: number[];
}

export interface HtmlTableParseResult extends HtmlRowsResult {
  tables: DetectedTable[];
}

export interface FetchPageError {
  error: string;
}

export interface HtmlImportResult {
  batchId: number;
  rowCount: number;
  errors: string[];
  tables: DetectedTable[];
}

export type CreateBatchFromHtmlUrlOptions = {
  seasonLabel?: string;
  selectedTableIndices?: number[];
  trustedDomains?: string[];
  fetcher?: typeof fetch;
};

const PRIVATE_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\]|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/i;
const PRIVATE_IPV6_RE = /^\[?(?:fe80|fc00|fd00|::1|f[cd])/i;

const MAX_REDIRECTS = 5;

export function validateFixtureUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "Only http:// and https:// URLs are allowed";
    }
    if (parsed.username || parsed.password) {
      return "URLs containing credentials are not allowed";
    }
    const host = parsed.hostname;
    if (PRIVATE_HOST_RE.test(host)) {
      return "URL points to a private or restricted network address";
    }
    if (PRIVATE_IPV6_RE.test(host)) {
      return "URL points to a private or restricted IPv6 address";
    }
    return null;
  } catch {
    return "Invalid URL";
  }
}

export async function fetchPage(
  url: string,
  options?: {
    timeout?: number;
    maxBytes?: number;
    fetcher?: typeof fetch;
    trustedDomains?: string[];
  }
): Promise<{ html: string } | FetchPageError> {
  const timeoutMs = options?.timeout ?? 15000;
  const maxBytes = options?.maxBytes ?? 2_000_000;
  const doFetch = options?.fetcher ?? globalThis.fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = url;

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const validation = validateFixtureUrl(currentUrl);
      if (validation) return { error: validation };

      const parsedUrl = new URL(currentUrl);
      const hostname = parsedUrl.hostname;

      const { error: dnsError, dnsAvailable } = await checkPrivateDNS(hostname);
      if (dnsError) return { error: dnsError };

      if (!dnsAvailable) {
        const trusted = options?.trustedDomains;
        if (!trusted || !trusted.some((d) => hostname === d || hostname.endsWith("." + d))) {
          return {
            error: `Host ${hostname} could not be validated via DNS and is not in the trusted domain list. ` +
              `Configure trustedDomains to import from this URL.`,
          };
        }
      }

      let response: Response;
      try {
        response = await doFetch(currentUrl, {
          signal: controller.signal,
          redirect: "manual",
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return { error: `Request timed out after ${timeoutMs}ms` };
        }
        return { error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}` };
      }

      const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
      if (isRedirect) {
        if (redirects >= MAX_REDIRECTS) {
          return { error: `Too many redirects (max ${MAX_REDIRECTS})` };
        }
        const location = response.headers.get("location");
        if (!location) return { error: "Redirect missing Location header" };
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) {
        return { error: `Content type is ${contentType}, expected text/html` };
      }

      const contentLength = parseInt(response.headers.get("content-length") ?? "0", 10);
      if (contentLength > maxBytes) {
        return { error: `Response too large: ${contentLength} bytes (max ${maxBytes})` };
      }

      const reader = response.body?.getReader();
      if (!reader) return { error: "Response body is not readable" };

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          reader.cancel();
          return { error: `Response exceeded ${maxBytes} byte limit` };
        }
        chunks.push(value);
      }

      const html = new TextDecoder().decode(concatUint8(chunks));
      return { html };
    }

    return { error: `Too many redirects (max ${MAX_REDIRECTS})` };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { error: `Request timed out after ${timeoutMs}ms` };
    }
    return { error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    clearTimeout(timer);
  }
}

export function extractTables(html: string): DetectedTable[] {
  const tables: DetectedTable[] = [];
  let tableIndex = 0;

  const headings = extractHeadings(html);
  let searchFrom = 0;

  while (true) {
    const tableStart = html.indexOf("<table", searchFrom);
    if (tableStart === -1) break;

    const extracted = extractOneTable(html, tableStart);
    if (!extracted) {
      searchFrom = tableStart + 6;
      continue;
    }

    const { fullHtml, innerHtml } = extracted;

    const caption = extractCaption(fullHtml, headings, tableStart);
    const rawRows = extractRawRows(innerHtml);
    if (rawRows.length === 0) {
      searchFrom = tableStart + fullHtml.length;
      continue;
    }

    const { headers, dataRows } = detectHeaders(rawRows);
    if (dataRows.length === 0) {
      searchFrom = tableStart + fullHtml.length;
      continue;
    }

    const fixtureRows = dataRows.filter((cells) => !isStructuralRow(cells));
    if (fixtureRows.length === 0) {
      searchFrom = tableStart + fullHtml.length;
      continue;
    }

    const score = scoreTable(headers, fixtureRows);

    tables.push({
      tableIndex,
      caption,
      headers,
      rows: fixtureRows,
      rowCount: fixtureRows.length,
      sampleCells: fixtureRows.slice(0, 3),
      score,
    });

    tableIndex++;
    searchFrom = tableStart + fullHtml.length;
  }

  return tables.sort((a, b) => b.score - a.score);
}

export function parseHtmlTableRows(
  table: DetectedTable,
  sourceUrl: string
): HtmlRowsResult {
  const mapping = buildHeaderMapping(table.headers);
  const hasMapping = Object.keys(mapping).length > 0;
  const rows: NormalizedFixtureRow[] = [];
  const errors: HtmlRowParseError[] = [];

  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
    const cells = table.rows[rowIndex];
    const fieldValues: Record<string, string | undefined> = {};

    if (hasMapping) {
      for (const [colIndex, fieldName] of Object.entries(mapping)) {
        const cellValue = cells[Number(colIndex)];
        if (cellValue !== undefined && cellValue !== "") {
          fieldValues[fieldName] = cellValue;
        }
      }
    } else {
      if (cells.length >= 5 && cells[3].trim() === "v") {
        fieldValues.homeParticipantRaw = cells[2];
        fieldValues.awayParticipantRaw = cells[4];
        if (cells[0]) fieldValues.kickoffDate = cells[0];
        if (cells[1]) fieldValues.kickoffTime = cells[1];
      } else {
        fieldValues.homeParticipantRaw = cells[0];
        fieldValues.awayParticipantRaw = cells[1];
        if (cells.length >= 3) fieldValues.competitionRaw = cells[2];
        if (cells.length >= 4) fieldValues.kickoffDate = cells[3];
        if (cells.length >= 5) fieldValues.venueRaw = cells[4];
      }
    }

    const rowErrors: string[] = [];
    if (!fieldValues.homeParticipantRaw) {
      rowErrors.push("Missing home team");
    }
    if (!fieldValues.awayParticipantRaw) {
      rowErrors.push("Missing away team");
    }

    if (rowErrors.length > 0) {
      errors.push({ rowIndex, message: rowErrors.join("; ") });
      continue;
    }

    const normalized: NormalizedFixtureRow = {
      homeParticipantRaw: fieldValues.homeParticipantRaw ?? "",
      awayParticipantRaw: fieldValues.awayParticipantRaw ?? "",
    };

    if (fieldValues.kickoffDate) {
      const parsed = parseDateField(fieldValues.kickoffDate);
      if (parsed) {
        normalized.kickoffDate = parsed.date;
        if (parsed.time) normalized.kickoffTime = parsed.time;
      }
    }
    if (fieldValues.kickoffTime) {
      normalized.kickoffTime = parseTimeField(fieldValues.kickoffTime) ?? fieldValues.kickoffTime;
    }
    if (fieldValues.competitionRaw) normalized.competitionRaw = fieldValues.competitionRaw;
    if (fieldValues.venueRaw) normalized.venueRaw = fieldValues.venueRaw;
    if (fieldValues.status) {
      const maybeTime = parseTimeField(fieldValues.status);
      if (maybeTime) {
        normalized.kickoffTime = maybeTime;
      } else {
        normalized.status = parseStatusField(fieldValues.status);
      }
    }
    if (fieldValues.ticketUrl) normalized.ticketUrl = fieldValues.ticketUrl;
    if (fieldValues.sourceUrl) normalized.sourceUrl = fieldValues.sourceUrl;
    if (fieldValues.adultPricePence) normalized.adultPricePence = parsePriceField(fieldValues.adultPricePence);
    if (fieldValues.concessionPricePence) {
      normalized.concessionPricePence = parsePriceField(fieldValues.concessionPricePence);
    }

    normalized.evidence = {
      source_url: sourceUrl,
      table_index: table.tableIndex,
      table_caption: table.caption,
      row_index: rowIndex,
      original_cells: cells,
      mapped_headers: mapping,
    };

    rows.push(normalized);
  }

  return { rows, errors };
}

export function parseHtmlTables(
  html: string,
  options?: HtmlTableParseOptions
): HtmlTableParseResult {
  const allTables = extractTables(html);
  const selected = options?.selectedTableIndices !== undefined
    ? allTables.filter((t) => options.selectedTableIndices!.includes(t.tableIndex))
    : allTables;

  const allRows: NormalizedFixtureRow[] = [];
  const allErrors: HtmlRowParseError[] = [];
  const sourceUrl = options?.sourceUrl ?? "";

  for (const table of selected) {
    const { rows, errors } = parseHtmlTableRows(table, sourceUrl);
    allRows.push(...rows);
    allErrors.push(...errors);
  }

  if (sourceUrl && isFriendlyFixturesUrl(sourceUrl)) {
    for (const row of allRows) {
      if (!row.competitionRaw) {
        row.competitionRaw = "Non-League Friendlies";
      }
      row.awayIsOneOff = true;
    }
  }

  return { rows: allRows, errors: allErrors, tables: allTables };
}

export async function createImportBatchFromHtmlUrl(
  db: AppDatabase,
  url: string,
  actor: string,
  options?: CreateBatchFromHtmlUrlOptions & { kickoffAssumptionPolicy?: KickoffAssumptionPolicy }
): Promise<HtmlImportResult> {
  const fetchResult = await fetchPage(url, {
    fetcher: options?.fetcher,
    trustedDomains: options?.trustedDomains,
  });
  if ("error" in fetchResult) {
    return { batchId: 0, rowCount: 0, errors: [fetchResult.error], tables: [] };
  }

  const { rows: allRows, errors: allErrors, tables: allTables } = parseHtmlTables(fetchResult.html, {
    sourceUrl: url,
    selectedTableIndices: options?.selectedTableIndices,
  });

  if (allTables.length === 0) {
    return { batchId: 0, rowCount: 0, errors: ["No fixture tables found in the page"], tables: [] };
  }

  if (options?.selectedTableIndices !== undefined && allRows.length === 0 && allErrors.length === 0) {
    return { batchId: 0, rowCount: 0, errors: ["No tables selected"], tables: allTables };
  }

  const parsedUrl = new URL(url);
  const source = await getOrCreateSource(db, {
    sourceType: "url_table_scrape",
    name: parsedUrl.origin,
    baseUrl: parsedUrl.origin,
  });

  const totalRows = allRows.length + allErrors.length;

  const batch = await createBatch(db, {
    sourceId: source.id,
    adapterType: "url_table_scrape",
    actor,
    rawPayload: url,
    seasonLabel: options?.seasonLabel,
  });

  if (allRows.length > 0) {
    await addBatchRows(
      db,
      batch.id,
      allRows.map((row, i) => ({ rowIndex: i, row }))
    );
  }

  try {
    await updateBatchCounts(db, batch.id, {
      rowCountTotal: totalRows,
      rowCountFailed: allErrors.length,
      parseErrorsJson: allErrors.length > 0
        ? JSON.stringify(allErrors)
        : null,
    });
    await updateBatchStatus(db, batch.id, {
      parseStatus: "parsed",
      approvalStatus: "preview",
    });
  } catch (err) {
    await updateBatchStatus(db, batch.id, { parseStatus: "failed" });
    throw err;
  }

  return {
    batchId: batch.id,
    rowCount: allRows.length,
    errors: allErrors.map((e) => e.message),
    tables: allTables,
  };
}

export const htmlTableFixtureSourceAdapter: FixtureSourceAdapter<
  HtmlTableParseResult,
  HtmlImportResult,
  HtmlTableParseOptions,
  [actor: string, options?: CreateBatchFromHtmlUrlOptions]
> = {
  sourceType: "url_table_scrape",
  name: "HTML table fixture import",
  parse: parseHtmlTables,
  createImportBatch: createImportBatchFromHtmlUrl,
};

function isFriendlyFixturesUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("footballwebpages.co.uk")
      && /\/non-league-friendlies\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

function concatUint8(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadings(html: string): { position: number; text: string }[] {
  const headings: { position: number; text: string }[] = [];
  const re = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    headings.push({ position: match.index, text: stripHtml(match[2]) });
  }
  return headings;
}

function extractOneTable(
  html: string,
  startIndex: number
): { fullHtml: string; innerHtml: string } | null {
  const openEnd = html.indexOf(">", startIndex);
  if (openEnd === -1) return null;

  let depth = 1;
  let i = openEnd + 1;
  while (i < html.length - 7 && depth > 0) {
    const rest = html.substring(i, i + 7).toLowerCase();
    if (rest === "</table") {
      depth--;
      if (depth === 0) {
        const end = html.indexOf(">", i + 7);
        if (end === -1) return null;
        return {
          fullHtml: html.substring(startIndex, end + 1),
          innerHtml: html.substring(openEnd + 1, i),
        };
      }
      i += 7;
    } else if (html[i] === "<") {
      const next = html.substring(i + 1, i + 6).toLowerCase();
      if (next === "table" && /[\s>]/.test(html[i + 6] ?? "")) {
        depth++;
        i += 6;
      }
    }
    i++;
  }

  return null;
}

function extractCaption(
  fullHtml: string,
  headings: { position: number; text: string }[],
  tablePosition: number
): string | null {
  const capMatch = /<caption[^>]*>(.*?)<\/caption>/i.exec(fullHtml);
  if (capMatch) return stripHtml(capMatch[1]);

  let best: { pos: number; text: string } | null = null;
  for (const h of headings) {
    const dist = tablePosition - h.position;
    if (dist > 0 && dist < 500 && (!best || dist < tablePosition - best.pos)) {
      best = { pos: h.position, text: h.text };
    }
  }
  return best?.text ?? null;
}

function extractRawRows(innerHtml: string): string[] {
  const rows: string[] = [];
  const re = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(innerHtml)) !== null) {
    const content = match[1].trim();
    if (content) rows.push(content);
  }
  return rows;
}

function extractRowCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const re = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(rowHtml)) !== null) {
    cells.push(stripHtml(match[1]));
  }
  return cells;
}

function isStructuralRow(cells: string[]): boolean {
  if (cells.length === 0) return true;
  if (cells.length === 1 && (!cells[0] || !cells[0].trim())) return true;
  if (cells.length === 1) {
    const text = cells[0].trim();
    if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/i.test(text)) return true;
  }
  return false;
}

function detectHeaders(rawRows: string[]): { headers: string[]; dataRows: string[][] } {
  const firstCells = extractRowCells(rawRows[0]);

  const hasTh = /<th/i.test(rawRows[0]);
  if (hasTh) {
    const headerMatches = firstCells.filter((h) => HEADER_ALIASES[h.toLowerCase().trim()]);
    if (headerMatches.length >= 2) {
      return { headers: firstCells, dataRows: rawRows.slice(1).map(extractRowCells) };
    }
  }

  const headerMatches = firstCells.filter((h) => HEADER_ALIASES[h.toLowerCase().trim()]);
  if (headerMatches.length >= 2 && firstCells.length >= 3) {
    return { headers: firstCells, dataRows: rawRows.slice(1).map(extractRowCells) };
  }

  return { headers: [], dataRows: rawRows.map(extractRowCells) };
}

function scoreTable(headers: string[], dataRows: string[][]): number {
  let score = 0;
  const colCount = headers.length > 0 ? headers.length : (dataRows[0]?.length ?? 0);
  if (colCount >= 3 && colCount <= 10) score += 3;

  const keywords = ["team", "home", "away", "date", "time", "kickoff", "venue", "ground", "competition"];
  for (const h of headers) {
    const lower = h.toLowerCase().trim();
    if (keywords.some((k) => lower.includes(k))) score += 1;
  }

  const datePattern = /\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})\b/i;
  if (dataRows.some((row) => row.some((cell) => datePattern.test(cell)))) score += 2;

  const teamPattern = /^[A-Za-z][A-Za-z\s.'&]+$/;
  if (dataRows.some((row) => row.some((cell) => {
    const t = cell.trim();
    return teamPattern.test(t) && t.split(/\s+/).length >= 2;
  }))) score += 2;

  return score;
}

function buildHeaderMapping(headers: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const lower = headers[i].toLowerCase().trim();
    const field = HEADER_ALIASES[lower];
    if (field) mapping[i] = field;
  }
  return mapping;
}

async function checkPrivateDNS(
  hostname: string
): Promise<{ error?: string; dnsAvailable: boolean }> {
  try {
    const dnsModule = await import("node:dns");
    try {
      const addresses = await dnsModule.promises.resolve4(hostname);
      for (const ip of addresses) {
        if (isPrivateIPv4(ip)) {
          return { error: `Host ${hostname} resolves to private IP: ${ip}`, dnsAvailable: true };
        }
      }
    } catch {
      // DNS lookup failed for this hostname — not necessarily an issue
    }
    return { dnsAvailable: true };
  } catch {
    // DNS module unavailable (e.g. Workers without nodejs_compat)
    return { dnsAvailable: false };
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;
  if (parts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}
