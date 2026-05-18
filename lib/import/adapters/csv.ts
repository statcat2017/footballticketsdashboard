import type { AppDatabase } from "../../db/adapter.ts";
import type { NormalizedFixtureRow, FixtureStatus } from "../types.ts";
import { createBatch, addBatchRows, updateBatchCounts, updateBatchStatus } from "../index.ts";

export interface CsvParseError {
  rowIndex: number;
  message: string;
}

export interface CsvParseResult {
  rows: NormalizedFixtureRow[];
  errors: CsvParseError[];
  detectedMapping: Record<number, string>;
}

export interface CreateBatchFromCsvResult {
  batchId: number;
  rowCount: number;
  errors: CsvParseError[];
}

export const HEADER_ALIASES: Record<string, string> = {
  home: "homeParticipantRaw",
  "home team": "homeParticipantRaw",
  "home club": "homeParticipantRaw",
  away: "awayParticipantRaw",
  "away team": "awayParticipantRaw",
  "away club": "awayParticipantRaw",
  date: "kickoffDate",
  "fixture date": "kickoffDate",
  "match date": "kickoffDate",
  time: "kickoffTime",
  "kickoff time": "kickoffTime",
  "kick off": "kickoffTime",
  competition: "competitionRaw",
  division: "competitionRaw",
  venue: "venueRaw",
  ground: "venueRaw",
  price: "adultPricePence",
  "adult price": "adultPricePence",
  "concession price": "concessionPricePence",
  concession: "concessionPricePence",
  ticket: "ticketUrl",
  "ticket url": "ticketUrl",
  source: "sourceUrl",
  status: "status",
};

export function parseCsv(csvText: string): CsvParseResult {
  const errors: CsvParseError[] = [];
  const rawRows = parseCsvRows(csvText);

  if (rawRows.length === 0) {
    return { rows: [], errors: [], detectedMapping: {} };
  }

  const { headers, dataRows, detectedMapping } = detectHeadersAndMapping(rawRows);

  const rows: NormalizedFixtureRow[] = [];
  let dataIndex = 0;

  for (const row of dataRows) {
    const fieldValues: Record<string, string | undefined> = {};

    for (const [colIndex, fieldName] of Object.entries(detectedMapping)) {
      const cellValue = row.cells[Number(colIndex)];
      if (cellValue !== undefined && cellValue !== "") {
        fieldValues[fieldName] = cellValue;
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
      errors.push({ rowIndex: dataIndex, message: rowErrors.join("; ") });
      dataIndex++;
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
      } else {
        normalized.kickoffDate = fieldValues.kickoffDate;
      }
    }
    if (fieldValues.kickoffTime) {
      normalized.kickoffTime = parseTimeField(fieldValues.kickoffTime) ?? fieldValues.kickoffTime;
    }
    if (fieldValues.competitionRaw) {
      normalized.competitionRaw = fieldValues.competitionRaw;
    }
    if (fieldValues.venueRaw) {
      normalized.venueRaw = fieldValues.venueRaw;
    }
    if (fieldValues.status) {
      normalized.status = parseStatusField(fieldValues.status);
    }
    if (fieldValues.ticketUrl) {
      normalized.ticketUrl = fieldValues.ticketUrl;
    }
    if (fieldValues.sourceUrl) {
      normalized.sourceUrl = fieldValues.sourceUrl;
    }
    if (fieldValues.adultPricePence) {
      normalized.adultPricePence = parsePriceField(fieldValues.adultPricePence);
    }
    if (fieldValues.concessionPricePence) {
      normalized.concessionPricePence = parsePriceField(fieldValues.concessionPricePence);
    }

    const evidence: Record<string, unknown> = {
      original_cells: row.cells,
      row_index: row.rowIndex,
    };

    if (headers) {
      evidence.headers = headers;
    }

    normalized.evidence = evidence;

    rows.push(normalized);
    dataIndex++;
  }

  return { rows, errors, detectedMapping };
}

export async function createImportBatchFromCsv(
  db: AppDatabase,
  csvText: string,
  sourceId: number,
  actor: string,
  options?: {
    seasonLabel?: string;
  }
): Promise<CreateBatchFromCsvResult> {
  const result = parseCsv(csvText);
  const totalRows = result.rows.length + result.errors.length;

  const batch = await createBatch(db, {
    sourceId,
    adapterType: "csv_paste",
    actor,
    rawPayload: csvText,
    seasonLabel: options?.seasonLabel,
  });

  if (result.rows.length > 0) {
    const rowInputs = result.rows.map((row, i) => ({
      rowIndex: i,
      row,
    }));
    await addBatchRows(db, batch.id, rowInputs);
  }

  try {
    await updateBatchCounts(db, batch.id, {
      rowCountTotal: totalRows,
      rowCountFailed: result.errors.length,
      parseErrorsJson: result.errors.length > 0
        ? JSON.stringify(result.errors)
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
    rowCount: result.rows.length,
    errors: result.errors,
  };
}

function parseCsvRows(text: string): { cells: string[]; rowIndex: number }[] {
  if (text.length > 0 && text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const rows: { cells: string[]; rowIndex: number }[] = [];
  let currentCells: string[] = [];
  let currentCell = "";
  let inQuotes = false;
  let rowIndex = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        currentCells.push(currentCell.trim());
        currentCell = "";
      } else if (ch === "\r") {
        currentCells.push(currentCell.trim());
        currentCell = "";
        if (currentCells.some((c) => c.length > 0)) {
          rows.push({ cells: currentCells, rowIndex });
          rowIndex++;
        }
        currentCells = [];
        if (i + 1 < text.length && text[i + 1] === "\n") {
          i++;
        }
      } else if (ch === "\n") {
        currentCells.push(currentCell.trim());
        currentCell = "";
        if (currentCells.some((c) => c.length > 0)) {
          rows.push({ cells: currentCells, rowIndex });
          rowIndex++;
        }
        currentCells = [];
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCells.length > 0 || currentCell.length > 0) {
    currentCells.push(currentCell.trim());
    if (currentCells.some((c) => c.length > 0)) {
      rows.push({ cells: currentCells, rowIndex });
    }
  }

  return rows;
}

function detectHeadersAndMapping(
  rows: { cells: string[]; rowIndex: number }[]
): {
  headers: string[] | null;
  dataRows: { cells: string[]; rowIndex: number }[];
  detectedMapping: Record<number, string>;
} {
  const detectedMapping: Record<number, string> = {};

  const firstRow = rows[0];
  if (!firstRow) {
    return { headers: null, dataRows: [], detectedMapping };
  }

  const matchedHeaders: string[] = [];
  let headerCount = 0;

  for (const cell of firstRow.cells) {
    const lower = cell.toLowerCase().trim();
    const mapped = HEADER_ALIASES[lower];
    matchedHeaders.push(mapped ?? "");
    if (mapped) headerCount++;
  }

  const isHeaderRow = headerCount >= 2;

  if (isHeaderRow) {
    for (let i = 0; i < matchedHeaders.length; i++) {
      if (matchedHeaders[i]) {
        detectedMapping[i] = matchedHeaders[i];
      }
    }
    return {
      headers: firstRow.cells,
      dataRows: rows.slice(1),
      detectedMapping,
    };
  }

  if (firstRow.cells.length >= 2) {
    detectedMapping[0] = "homeParticipantRaw";
    detectedMapping[1] = "awayParticipantRaw";
    if (firstRow.cells.length >= 3) detectedMapping[2] = "competitionRaw";
    if (firstRow.cells.length >= 4) detectedMapping[3] = "kickoffDate";
    if (firstRow.cells.length >= 5) detectedMapping[4] = "venueRaw";
  }

  return {
    headers: null,
    dataRows: rows,
    detectedMapping,
  };
}

export function parseDateField(value: string): { date: string; time?: string } | undefined {
  const trimmed = value.trim();
  let timePart: string | undefined;
  let datePart = trimmed;

  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (/^\d{1,2}:\d{2}/.test(last)) {
      timePart = parseTimeField(last);
      datePart = parts.slice(0, -1).join(" ");
    }
  }

  let year: number, month: number, day: number;

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(datePart);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
    if (!isValidDate(year, month, day)) return undefined;
    return { date: `${pad(year, 4)}-${pad(month)}-${pad(day)}`, time: timePart };
  }

  const ukMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(datePart);
  if (ukMatch) {
    day = parseInt(ukMatch[1], 10);
    month = parseInt(ukMatch[2], 10);
    year = parseInt(ukMatch[3], 10);
    if (!isValidDate(year, month, day)) return undefined;
    return { date: `${pad(year, 4)}-${pad(month)}-${pad(day)}`, time: timePart };
  }

  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };

  const longMatch = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i.exec(datePart);
  if (longMatch) {
    const monthStr = months[longMatch[2].toLowerCase().slice(0, 3)];
    if (monthStr) {
      day = parseInt(longMatch[1], 10);
      month = parseInt(monthStr, 10);
      year = parseInt(longMatch[3], 10);
      if (!isValidDate(year, month, day)) return undefined;
      return { date: `${pad(year, 4)}-${pad(month)}-${pad(day)}`, time: timePart };
    }
  }

  const usMatch = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i.exec(datePart);
  if (usMatch) {
    const monthStr = months[usMatch[1].toLowerCase().slice(0, 3)];
    if (monthStr) {
      month = parseInt(monthStr, 10);
      day = parseInt(usMatch[2], 10);
      year = parseInt(usMatch[3], 10);
      if (!isValidDate(year, month, day)) return undefined;
      return { date: `${pad(year, 4)}-${pad(month)}-${pad(day)}`, time: timePart };
    }
  }

  return undefined;
}

export function parseTimeField(value: string): string | undefined {
  const trimmed = value.trim();

  const hhmmMatch = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm))?$/.exec(trimmed);
  if (hhmmMatch) {
    let hours = parseInt(hhmmMatch[1], 10);
    const minutes = parseInt(hhmmMatch[2], 10);

    if (minutes < 0 || minutes > 59) return undefined;

    const suffix = hhmmMatch[3];
    if (suffix) {
      const isPM = suffix.toUpperCase() === "PM";
      if (hours === 0 || hours > 12) return undefined;
      if (isPM && hours < 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
    } else {
      if (hours < 0 || hours > 23) return undefined;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const hourOnly = /^(\d{1,2})\s*(AM|PM|am|pm)$/.exec(trimmed);
  if (hourOnly) {
    let hours = parseInt(hourOnly[1], 10);
    if (hours === 0 || hours > 12) return undefined;
    if (hourOnly[2].toUpperCase() === "PM" && hours < 12) hours += 12;
    if (hourOnly[2].toUpperCase() === "AM" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:00`;
  }

  return undefined;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  const maxDay = new Date(year, month, 0).getDate();
  return day <= maxDay;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

export function parseStatusField(value: string): FixtureStatus {
  const trimmed = value.trim().toLowerCase();
  const valid: FixtureStatus[] = ["scheduled", "postponed", "cancelled", "finished", "unknown"];
  return valid.includes(trimmed as FixtureStatus) ? (trimmed as FixtureStatus) : "scheduled";
}

export function parsePriceField(value: string): number | undefined {
  const cleaned = value.replace(/[£$,€\s]/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return undefined;

  const pounds = parseInt(match[1], 10);
  let pence = 0;

  if (match[2] !== undefined) {
    pence = parseInt(match[2].padEnd(2, "0"), 10);
  }

  return pounds * 100 + pence;
}
