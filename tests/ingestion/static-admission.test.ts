import { describe, expect, it } from "vitest";

import { parseStaticAdmissionPolicy } from "@/lib/ingestion";

const html = `
  <h3>Men's Games</h3>
  <p>Here are the match-day ticket prices for the 2025-26 Isthmian League.</p>
  <p>£13 for Adults</p>
  <p>£5.50 for Concessions</p>
  <p>Under 13s FREE accompanied by a paying adult</p>
  <p><a href="https://app.fanbaseclub.com/Fan/Fixtures/Index?fanStoreType=Fixtures&amp;clubId=123">Men's tickets via Fanbase</a></p>
  <h3>Women's Tickets</h3>
  <p>£5 for Adults</p>
  <p>£2.50 for Concessions</p>
  <p>Under 13s FREE accompanied by a paying adult.</p>
  <h3>Concessions</h3>
  <p>Concessions cover Seniors - 65+, Teenagers (13-19), Unemployed (JSA), NHS Staff, Blue Light Services, Serving Members of the Armed Forces, Local Authority Workers and Full Time Students. Please bring a form of valid ID.</p>
`;

describe("parseStaticAdmissionPolicy", () => {
  it("parses labelled Step 3 price bands", () => {
    const policy = parseStaticAdmissionPolicy(html, {
      sourceUrl: "https://dulwichhamletfc.co.uk/fixtures/ticket-prices",
      observedAt: "2026-05-09T10:00:00.000Z"
    });

    expect(policy.seasonLabel).toBe("2025-26");
    expect(policy.priceBands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "men-adult", amountPence: 1300 }),
        expect.objectContaining({ id: "men-concession", amountPence: 550 }),
        expect.objectContaining({ id: "women-adult", amountPence: 500 }),
        expect.objectContaining({ id: "women-concession", amountPence: 250 })
      ])
    );
  });

  it("captures concession and conditional child rules", () => {
    const policy = parseStaticAdmissionPolicy(html, {
      sourceUrl: "https://dulwichhamletfc.co.uk/fixtures/ticket-prices",
      observedAt: "2026-05-09T10:00:00.000Z"
    });

    expect(policy.concessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Senior 65+", minAge: 65 }),
        expect.objectContaining({ label: "Teenager 13-19", minAge: 13, maxAge: 19 }),
        expect.objectContaining({ label: "Under 13 with paying adult", maxAge: 12 })
      ])
    );
    expect(policy.eligibility).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "id_required" }),
        expect.objectContaining({ type: "must_be_with_adult" })
      ])
    );
  });
});
