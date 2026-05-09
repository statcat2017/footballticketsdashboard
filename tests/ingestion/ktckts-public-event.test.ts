import { describe, expect, it } from "vitest";

import { createAdapterContext, parseKtcktsBrandHtml, parseKtcktsEventHtml, runKtcktsPublicUrl } from "@/lib/ingestion";

const mapping = {
  clubName: "Needham Market",
  team: "men" as const,
  competitionLevel: "Southern Premier Central",
  defaultVenueName: "Bloomfields",
  defaultVenuePostcode: "IP6 8DA"
};

describe("Ktckts public event adapter", () => {
  it("discovers brand page events from JSON-LD item lists", () => {
    const events = parseKtcktsBrandHtml(
      `<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"name":"Needham Market v Barwell FC","url":"/event/nee2526h20/needham-market-v-barwell-fc"}]}</script>`,
      "https://needhammarketfc.ktckts.com/brand/match-tickets"
    );

    expect(events).toEqual([
      expect.objectContaining({
        title: "Needham Market v Barwell FC",
        url: "https://needhammarketfc.ktckts.com/event/nee2526h20/needham-market-v-barwell-fc"
      })
    ]);
  });

  it("parses event JSON-LD price and venue metadata", () => {
    const lead = parseKtcktsEventHtml(
      `
      <script type="application/ld+json">{
        "@type":"Event",
        "name":"Needham Market v Barwell FC",
        "location":{"name":"Bloomfields"},
        "performer":{"name":"Southern Premier Central"},
        "offers":{"url":"https://needhammarketfc.ktckts.com/event/nee2526h20/needham-market-v-barwell-fc","availability":"https://schema.org/InStock","price":"5.00","priceCurrency":"GBP"}
      }</script>
      `,
      "https://needhammarketfc.ktckts.com/event/nee2526h20/needham-market-v-barwell-fc",
      "2026-05-09T10:00:00.000Z",
      mapping
    );

    expect(lead.fixtureStableKey).toBe("ktckts:nee2526h20");
    expect(lead.priceBands).toContainEqual(expect.objectContaining({ amountPence: 500 }));
    expect(lead.venue).toEqual(expect.objectContaining({ name: "Bloomfields", postcode: "IP6 8DA" }));
  });

  it("maps no-products pages to empty success", async () => {
    const result = await runKtcktsPublicUrl(
      createAdapterContext({
        now: new Date("2026-05-09T10:00:00.000Z"),
        fetch: async () => new Response("<p>There are currently no products on sale.</p>")
      }),
      "https://needhammarketfc.ktckts.com/brand/match-tickets",
      mapping
    );

    expect(result.leads).toHaveLength(0);
    expect(result.diagnostics[0]).toEqual(expect.objectContaining({ code: "no_events" }));
  });

  it("does not treat unavailable Ktckts events as sold out", () => {
    const lead = parseKtcktsEventHtml(
      "<h1>Needham Market v Barwell FC</h1><p>This product is either only available to limited supporters or currently unavailable. Please log in.</p>",
      "https://needhammarketfc.ktckts.com/event/nee2526h20/needham-market-v-barwell-fc",
      "2026-05-09T10:00:00.000Z",
      mapping
    );

    expect(lead.sale.state).toBe("no_public_sale");
    expect(lead.dataQuality.warnings[0]).toContain("not treated as sold out");
  });
});
