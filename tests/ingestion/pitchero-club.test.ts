import { describe, expect, it } from "vitest";

import {
  applyPitcheroMatchCentreOverride,
  parsePitcheroAdmissionHtml,
  parsePitcheroFixtureHtml
} from "@/lib/ingestion";

const mapping = {
  clubName: "Aveley",
  team: "men" as const,
  competitionLevel: "Isthmian Premier",
  defaultVenueName: "Parkside",
  defaultVenuePostcode: "RM15 4PX"
};

describe("Pitchero club adapter", () => {
  it("parses admission page price bands", () => {
    const parsed = parsePitcheroAdmissionHtml(
      "<h1>Admission Fees 2025/26</h1><p>Adult £14</p><p>Concession £10</p><p>Under 16 £5</p>",
      "https://www.pitchero.com/clubs/aveley/a/admission-fees-202526-season-41065.html",
      "2026-05-09T10:00:00.000Z"
    );

    expect(parsed.priceBands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "adult", amountPence: 1400 }),
        expect.objectContaining({ id: "concession", amountPence: 1000 }),
        expect.objectContaining({ id: "under-16", amountPence: 500 })
      ])
    );
  });

  it("parses public fixture cards with static admission enrichment", () => {
    const priceBands = parsePitcheroAdmissionHtml(
      "<p>Adult £14</p><p>Concession £10</p>",
      "https://www.pitchero.com/clubs/aveley/a/admission-fees-202526-season-41065.html",
      "2026-05-09T10:00:00.000Z"
    ).priceBands;
    const leads = parsePitcheroFixtureHtml(
      `
      <article class="fixture-card">
        <h2>Aveley v Lewes</h2>
        <p>Competition: Isthmian Premier</p>
        <p>Venue: Parkside</p>
        <a href="/teams/111/match-centre/222">Match centre</a>
      </article>
      `,
      {
        sourceUrl: "https://www.pitchero.com/clubs/aveley/matches",
        observedAt: "2026-05-09T10:00:00.000Z",
        mapping,
        priceBands
      }
    );

    expect(leads[0]).toEqual(
      expect.objectContaining({
        adapterId: "pitcheroClubAdapter",
        purchaseUrl: "https://www.pitchero.com/teams/111/match-centre/222"
      })
    );
    expect(leads[0].venue).toEqual(expect.objectContaining({ postcode: "RM15 4PX" }));
    expect(leads[0].priceBands).toContainEqual(expect.objectContaining({ id: "adult", amountPence: 1400 }));
  });

  it("returns no leads for empty fixture pages", () => {
    const leads = parsePitcheroFixtureHtml("<main>No fixtures found</main>", {
      sourceUrl: "https://www.pitchero.com/clubs/aveley/matches",
      observedAt: "2026-05-09T10:00:00.000Z",
      mapping
    });

    expect(leads).toHaveLength(0);
  });

  it("uses explicit match-centre notes as fixture overrides", () => {
    const [lead] = parsePitcheroFixtureHtml(
      '<article class="fixture-card"><h2>Aveley v Lewes</h2><a href="/match-centre/1">Match centre</a></article>',
      {
        sourceUrl: "https://www.pitchero.com/clubs/aveley/matches",
        observedAt: "2026-05-09T10:00:00.000Z",
        mapping
      }
    );
    const overridden = applyPitcheroMatchCentreOverride(
      lead,
      "<article><p>This match is all-ticket. Adult £16. No pay on gate.</p></article>",
      "https://www.pitchero.com/clubs/aveley/teams/1/match-centre/1",
      "2026-05-09T11:00:00.000Z"
    );

    expect(overridden.priceBands).toContainEqual(expect.objectContaining({ amountPence: 1600, precedenceRank: 1 }));
    expect(overridden.sale.stateText).toMatch(/pay on gate/i);
  });
});
