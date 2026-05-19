import { describe, expect, it } from "vitest";

import { competitionName, competitionTier, competitionCodeFromDivisionCode } from "@/lib/db/competition";

describe("competitionName", () => {
  it("returns 'Premier League' for PL", () => {
    expect(competitionName("PL")).toBe("Premier League");
  });

  it("returns 'Championship' for ELC", () => {
    expect(competitionName("ELC")).toBe("Championship");
  });

  it("returns the code itself for unknown competitions", () => {
    expect(competitionName("UNKNOWN")).toBe("UNKNOWN");
    expect(competitionName("NLN")).toBe("NLN");
    expect(competitionName("FRIENDLY")).toBe("FRIENDLY");
  });
});

describe("competitionTier", () => {
  it("returns 1 for PL", () => {
    expect(competitionTier("PL")).toBe(1);
  });

  it("returns 2 for ELC", () => {
    expect(competitionTier("ELC")).toBe(2);
  });

  it("returns 5 for NL", () => {
    expect(competitionTier("NL")).toBe(5);
  });

  it("returns 6 for NLN and NLS", () => {
    expect(competitionTier("NLN")).toBe(6);
    expect(competitionTier("NLS")).toBe(6);
  });

  it("returns 2 as default for unknown codes", () => {
    expect(competitionTier("UNKNOWN")).toBe(2);
    expect(competitionTier("FRIENDLY")).toBe(2);
  });
});

describe("competitionCodeFromDivisionCode", () => {
  it("returns uppercased division code", () => {
    expect(competitionCodeFromDivisionCode("pl")).toBe("PL");
    expect(competitionCodeFromDivisionCode("ELC")).toBe("ELC");
    expect(competitionCodeFromDivisionCode("National League")).toBe("NATIONAL LEAGUE");
  });
});

import { defaultDateRange, inferAssumedKickoff, parseKickoffFromDateTime } from "@/lib/date";

describe("defaultDateRange", () => {
  it("returns today and today+14 days by default", () => {
    const now = new Date("2026-05-19T12:00:00.000Z");
    const result = defaultDateRange(now);
    expect(result.dateFrom).toBe("2026-05-19");
    expect(result.dateTo).toBe("2026-06-02");
  });

  it("respects custom daysAhead parameter", () => {
    const now = new Date("2026-05-19T12:00:00.000Z");
    const result = defaultDateRange(now, 7);
    expect(result.dateFrom).toBe("2026-05-19");
    expect(result.dateTo).toBe("2026-05-26");
  });

  it("handles month boundaries", () => {
    const now = new Date("2026-05-25T12:00:00.000Z");
    const result = defaultDateRange(now, 10);
    expect(result.dateFrom).toBe("2026-05-25");
    expect(result.dateTo).toBe("2026-06-04");
  });
});

describe("inferAssumedKickoff", () => {
  it("returns 15:00 for weekend fixtures", () => {
    // 2026-05-23 is a Saturday
    const result = inferAssumedKickoff("2026-05-23");
    expect(result.time).toBe("15:00");
    expect(result.status).toBe("assumed");
  });

  it("returns 15:00 for Sunday fixtures", () => {
    // 2026-05-24 is a Sunday
    const result = inferAssumedKickoff("2026-05-24");
    expect(result.time).toBe("15:00");
    expect(result.status).toBe("assumed");
  });

  it("returns 19:45 for weekday fixtures", () => {
    // 2026-05-19 is a Tuesday
    const result = inferAssumedKickoff("2026-05-19");
    expect(result.time).toBe("19:45");
    expect(result.status).toBe("assumed");
  });
});

describe("parseKickoffFromDateTime", () => {
  it("combines date and time into ISO string", () => {
    expect(parseKickoffFromDateTime("2026-05-19", "15:00")).toBe("2026-05-19T15:00:00.000Z");
  });

  it("returns null when date is null", () => {
    expect(parseKickoffFromDateTime(null, "15:00")).toBeNull();
  });

  it("returns null when time is null", () => {
    expect(parseKickoffFromDateTime("2026-05-19", null)).toBeNull();
  });
});

import { buildClubLookup, findClub, normalizeClubName } from "@/lib/db/clubLookup";
import type { ClubRow, FootballDataTeam } from "@/lib/db/clubLookup";

describe("normalizeClubName", () => {
  it("lowercases the name", () => {
    expect(normalizeClubName("Chelsea")).toBe("chelsea");
  });

  it("replaces & with 'and'", () => {
    expect(normalizeClubName("L&R United")).toBe("landr united");
  });

  it("collapses whitespace", () => {
    expect(normalizeClubName("  Arsenal  FC  ")).toBe("arsenal fc");
  });

  it("removes non-alphanumeric characters", () => {
    expect(normalizeClubName("St. James' Park")).toBe("st james park");
  });
});

describe("buildClubLookup", () => {
  const clubs: ClubRow[] = [
    { id: 1, name: "Chelsea", football_data_team_id: 61, aliases: null, short_name: "CHE", venue_id: 1 },
    { id: 2, name: "Arsenal", football_data_team_id: 57, aliases: "The Gunners|Ars", short_name: "ARS", venue_id: 3 },
    { id: 3, name: "Liverpool FC", football_data_team_id: null, aliases: null, short_name: "LIV", venue_id: 16 },
  ];

  it("builds a lookup by football_data_team_id", () => {
    const lookup = buildClubLookup(clubs);
    expect(lookup.get("football-data:61")?.id).toBe(1);
    expect(lookup.get("football-data:57")?.id).toBe(2);
  });

  it("skips football_data_team_id lookup when null", () => {
    const lookup = buildClubLookup(clubs);
    expect(lookup.get("football-data:null")).toBeUndefined();
  });

  it("indexes by normalized club name", () => {
    const lookup = buildClubLookup(clubs);
    expect(lookup.get("chelsea")?.id).toBe(1);
    expect(lookup.get("arsenal")?.id).toBe(2);
  });

  it("indexes by short_name", () => {
    const lookup = buildClubLookup(clubs);
    expect(lookup.get("che")?.id).toBe(1);
    expect(lookup.get("ars")?.id).toBe(2);
  });

  it("indexes by aliases", () => {
    const lookup = buildClubLookup(clubs);
    expect(lookup.get("the gunners")?.id).toBe(2);
    expect(lookup.get("ars")?.id).toBe(2);
  });
});

describe("findClub", () => {
  const clubs: ClubRow[] = [
    { id: 1, name: "Chelsea", football_data_team_id: 61, aliases: null, short_name: "CHE", venue_id: 1 },
    { id: 2, name: "Arsenal", football_data_team_id: 57, aliases: "The Gunners", short_name: "ARS", venue_id: 3 },
    { id: 4, name: "Manchester United FC", football_data_team_id: null, aliases: null, short_name: "MUN", venue_id: 4 },
  ];
  const lookup = buildClubLookup(clubs);

  it("finds by football_data_team_id", () => {
    const team: FootballDataTeam = { id: 61, name: "Chelsea FC" };
    expect(findClub(lookup, team)?.id).toBe(1);
  });

  it("finds by name fallback when no ID match", () => {
    const team: FootballDataTeam = { id: 999, name: "Arsenal" };
    expect(findClub(lookup, team)?.id).toBe(2);
  });

  it("finds by shortName fallback", () => {
    const team: FootballDataTeam = { id: 999, name: "Something Else", shortName: "CHE" };
    expect(findClub(lookup, team)?.id).toBe(1);
  });

  it("finds by alias", () => {
    const team: FootballDataTeam = { id: 999, name: "The Gunners" };
    expect(findClub(lookup, team)?.id).toBe(2);
  });

  it("returns undefined when no match", () => {
    const team: FootballDataTeam = { id: 999, name: "Non Existent FC" };
    expect(findClub(lookup, team)).toBeUndefined();
  });

  it("normalizes name before matching", () => {
    const team: FootballDataTeam = { id: 999, name: "Man. United FC" };
    const clubLookup = buildClubLookup([
      { id: 4, name: "Manchester United FC", football_data_team_id: null, aliases: "man united", short_name: "MUN", venue_id: 4 },
    ]);
    expect(findClub(clubLookup, team)?.id).toBe(4);
  });
});
