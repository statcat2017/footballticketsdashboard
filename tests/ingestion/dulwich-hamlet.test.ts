import { describe, expect, it } from "vitest";

import { parseDulwichFixturePage, parseStaticAdmissionPolicy } from "@/lib/ingestion";

const policy = parseStaticAdmissionPolicy(
  `
  <h3>Men's Games</h3><p>£13 for Adults</p><p>£5.50 for Concessions</p><p>Under 13s FREE accompanied by a paying adult</p>
  <h3>Women's Tickets</h3><p>£5 for Adults</p><p>£2.50 for Concessions</p><p>Under 13s FREE accompanied by a paying adult.</p>
  `,
  { sourceUrl: "https://dulwichhamletfc.co.uk/fixtures/ticket-prices", observedAt: "2026-05-09T10:00:00.000Z" }
);

describe("Dulwich Hamlet fixture parser", () => {
  it("returns empty success candidates for explicit no-fixtures pages", () => {
    const leads = parseDulwichFixturePage(
      '<div class="mdc-fixtures-list"><div class="mdc-no-fixtures">No fixtures found.</div></div>',
      {
        sourceUrl: "https://dulwichhamletfc.co.uk/fixtures/mens-fixtures-and-tickets?view=fixtures",
        observedAt: "2026-05-09T10:00:00.000Z",
        team: "men",
        policyPriceBands: policy.priceBands,
        purchaseUrl: null
      }
    );

    expect(leads).toHaveLength(0);
  });

  it("parses a home fixture card and applies static prices", () => {
    const leads = parseDulwichFixturePage(
      `
      <div class="mdc-fixture-card">
        <div class="mdc-fixture-competition">Isthmian Premier</div>
        <div class="mdc-fixture-opponent">Lewes</div>
        <div class="mdc-fixture-date">Sat 13 Dec</div>
        <div class="mdc-fixture-time">15:00</div>
        <div class="mdc-fixture-venue">Champion Hill Stadium</div>
        <a class="mdc-btn-tickets" href="https://app.fanbaseclub.com/Fan/Tickets/SelectType?fixtureId=16099">Tickets</a>
      </div>
      `,
      {
        sourceUrl: "https://dulwichhamletfc.co.uk/fixtures/mens-fixtures-and-tickets?view=fixtures",
        observedAt: "2026-05-09T10:00:00.000Z",
        team: "men",
        policyPriceBands: policy.priceBands,
        purchaseUrl: null
      }
    );

    expect(leads[0]).toEqual(
      expect.objectContaining({
        fixtureStableKey: "dulwich-hamlet:men:lewes:sat-13-dec",
        purchaseUrl: "https://app.fanbaseclub.com/Fan/Tickets/SelectType?fixtureId=16099"
      })
    );
    expect(leads[0].venue).toEqual(expect.objectContaining({ postcode: "SE22 8BD", postcodeStatus: "verified" }));
    expect(leads[0].priceBands).toContainEqual(expect.objectContaining({ id: "men-adult", amountPence: 1300 }));
  });
});
