import { describe, expect, it } from "vitest";

import { createAdapterContext, parseFanbasePublicEventHtml, runFanbasePublicEventUrl } from "@/lib/ingestion";

describe("Fanbase public event adapter", () => {
  it("parses public event text without claiming inventory", () => {
    const lead = parseFanbasePublicEventHtml(
      "<title>Dulwich Hamlet vs Lewes</title><main><p>Adult £13.00</p><p>Tickets available online</p></main>",
      {
        sourceUrl: "https://app.fanbaseclub.com/Fan/Tickets/SelectType?fixtureId=16099",
        observedAt: "2026-05-09T10:00:00.000Z",
        clubName: "Dulwich Hamlet FC"
      }
    );

    expect(lead.sale.state).toBe("available_lead");
    expect(lead.priceBands).toContainEqual(expect.objectContaining({ amountPence: 1300 }));
    expect(lead.source.complianceNotes[0]).toContain("no basket");
  });

  it("rejects checkout URLs", async () => {
    const result = await runFanbasePublicEventUrl(
      "https://app.fanbaseclub.com/Fan/Checkout?fixtureId=16099",
      createAdapterContext(),
      "Dulwich Hamlet FC"
    );

    expect(result.leads).toHaveLength(0);
    expect(result.diagnostics[0]).toEqual(expect.objectContaining({ code: "blocked" }));
  });
});
