import { describe, expect, it } from "vitest";

import type { FixtureSourceAdapter } from "@/lib/import";
import {
  csvFixtureSourceAdapter,
  fixtureSourceAdapters,
  getFixtureSourceAdapter,
  htmlTableFixtureSourceAdapter,
  parseCsv,
  parseHtmlTables,
} from "@/lib/import";

const adapters: readonly FixtureSourceAdapter[] = fixtureSourceAdapters;

describe("fixture source adapters", () => {
  it("exposes CSV and HTML adapters through the common contract", () => {
    expect(adapters.map((adapter) => adapter.sourceType)).toEqual([
      "csv_paste",
      "url_table_scrape",
    ]);
    expect(getFixtureSourceAdapter("csv_paste")).toBe(csvFixtureSourceAdapter);
    expect(getFixtureSourceAdapter("url_table_scrape")).toBe(htmlTableFixtureSourceAdapter);
  });

  it("parses CSV through the adapter without changing standalone behavior", () => {
    const csv = "Home,Away,Date\nTeam A,Team B,2026-05-20";

    expect(csvFixtureSourceAdapter.parse(csv)).toEqual(parseCsv(csv));
  });

  it("parses HTML tables through the adapter without changing standalone behavior", () => {
    const html = `<html><body>
<table>
  <tr><th>Home</th><th>Away</th><th>Date</th></tr>
  <tr><td>Team A</td><td>Team B</td><td>2026-05-20</td></tr>
</table>
</body></html>`;
    const options = { sourceUrl: "https://example.com/fixtures" };

    expect(htmlTableFixtureSourceAdapter.parse(html, options)).toEqual(parseHtmlTables(html, options));
  });
});
