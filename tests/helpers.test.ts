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

import { computeDateRange, defaultDateRange, inferAssumedKickoff, parseKickoffFromDateTime } from "@/lib/date";

describe("defaultDateRange", () => {
  it("returns today and the end of the next 14 calendar days by default", () => {
    const now = new Date("2026-05-19T12:00:00.000Z");
    const result = defaultDateRange(now);
    expect(result.dateFrom).toBe("2026-05-19");
    expect(result.dateTo).toBe("2026-06-01");
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

  it("adds calendar days across the UK spring clock change", () => {
    const now = new Date("2026-03-28T23:30:00.000Z");
    expect(defaultDateRange(now)).toEqual({ dateFrom: "2026-03-28", dateTo: "2026-04-10" });
  });
});

describe("computeDateRange", () => {
  it.each([
    ["Monday", "2026-10-19T12:00:00.000Z", "2026-10-23", "2026-10-25"],
    ["Tuesday", "2026-10-20T12:00:00.000Z", "2026-10-23", "2026-10-25"],
    ["Wednesday", "2026-10-21T12:00:00.000Z", "2026-10-23", "2026-10-25"],
    ["Thursday", "2026-10-22T12:00:00.000Z", "2026-10-23", "2026-10-25"],
    ["Friday", "2026-10-23T12:00:00.000Z", "2026-10-23", "2026-10-25"],
    ["Saturday", "2026-10-24T12:00:00.000Z", "2026-10-24", "2026-10-25"],
    ["Sunday", "2026-10-25T12:00:00.000Z", "2026-10-25", "2026-10-25"]
  ])("selects the remaining Friday–Sunday window on %s", (_day, now, dateFrom, dateTo) => {
    expect(computeDateRange("this-weekend", new Date(now))).toEqual({ dateFrom, dateTo });
  });

  it.each([
    ["Monday", "2026-10-19T12:00:00.000Z"],
    ["Tuesday", "2026-10-20T12:00:00.000Z"],
    ["Wednesday", "2026-10-21T12:00:00.000Z"],
    ["Thursday", "2026-10-22T12:00:00.000Z"],
    ["Friday", "2026-10-23T12:00:00.000Z"],
    ["Saturday", "2026-10-24T12:00:00.000Z"],
    ["Sunday", "2026-10-25T12:00:00.000Z"]
  ])("selects the following Friday–Sunday window on %s without Monday", (_day, now) => {
    expect(computeDateRange("next-weekend", new Date(now))).toEqual({ dateFrom: "2026-10-30", dateTo: "2026-11-01" });
  });

  it("uses the UK local calendar day around midnight and across month and year boundaries", () => {
    expect(computeDateRange("this-weekend", new Date("2026-10-22T23:30:00.000Z"))).toEqual({
      dateFrom: "2026-10-23",
      dateTo: "2026-10-25"
    });
    expect(computeDateRange("next-weekend", new Date("2026-12-31T12:00:00.000Z"))).toEqual({
      dateFrom: "2027-01-08",
      dateTo: "2027-01-10"
    });
  });

  it("returns the same calendar window under different process timezones", () => {
    const originalTimezone = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Honolulu";
      const hawaiiWindow = computeDateRange("this-weekend", new Date("2026-10-22T23:30:00.000Z"));
      process.env.TZ = "Asia/Tokyo";
      const tokyoWindow = computeDateRange("this-weekend", new Date("2026-10-22T23:30:00.000Z"));
      expect(tokyoWindow).toEqual(hawaiiWindow);
    } finally {
      if (originalTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimezone;
      }
    }
  });

  it("provides a 14-day default and a named wider all-dates range", () => {
    const now = new Date("2026-10-19T12:00:00.000Z");
    expect(computeDateRange("next-14-days", now)).toEqual({ dateFrom: "2026-10-19", dateTo: "2026-11-01" });
    expect(computeDateRange("all-upcoming", now)).toEqual({ dateFrom: "2026-10-19", dateTo: "2027-10-19" });
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

import type { Coordinate } from "@/lib/postcode";
import { distanceMiles } from "@/lib/distance";

describe("distanceMiles", () => {
  it("returns correct distance between two known points", () => {
    const london: Coordinate = { latitude: 51.5074, longitude: -0.1278 };
    const manchester: Coordinate = { latitude: 53.4808, longitude: -2.2426 };
    const dist = distanceMiles(london, manchester);
    expect(dist).toBeGreaterThan(150);
    expect(dist).toBeLessThan(170);
  });

  it("returns zero for same point", () => {
    const pt = { latitude: 51.5, longitude: -0.1 };
    expect(distanceMiles(pt, pt)).toBe(0);
  });

  it("returns Infinity when from latitude is NaN", () => {
    const from = { latitude: NaN, longitude: -0.1 };
    const to = { latitude: 51.5, longitude: -0.1 };
    expect(distanceMiles(from, to)).toBe(Infinity);
  });

  it("returns Infinity when from longitude is NaN", () => {
    const from = { latitude: 51.5, longitude: NaN };
    const to = { latitude: 51.5, longitude: -0.1 };
    expect(distanceMiles(from, to)).toBe(Infinity);
  });

  it("returns Infinity when to latitude is NaN", () => {
    const from = { latitude: 51.5, longitude: -0.1 };
    const to = { latitude: NaN, longitude: -0.1 };
    expect(distanceMiles(from, to)).toBe(Infinity);
  });

  it("returns Infinity when to longitude is NaN", () => {
    const from = { latitude: 51.5, longitude: -0.1 };
    const to = { latitude: 51.5, longitude: NaN };
    expect(distanceMiles(from, to)).toBe(Infinity);
  });

  it("returns Infinity when from latitude is Infinity", () => {
    const from = { latitude: Infinity, longitude: -0.1 };
    const to = { latitude: 51.5, longitude: -0.1 };
    expect(distanceMiles(from, to)).toBe(Infinity);
  });

  it("returns Infinity when coordinates are null-like (0/0 but valid)", () => {
    const from = { latitude: 51.5, longitude: -0.1 };
    const to = { latitude: 0, longitude: 0 };
    const dist = distanceMiles(from, to);
    expect(dist).toBeGreaterThan(0);
    expect(Number.isFinite(dist)).toBe(true);
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
