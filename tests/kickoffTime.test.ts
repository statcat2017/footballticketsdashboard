import { describe, expect, it } from "vitest";
import { formatKickoffInLondon, resolveKickoffInstant } from "@/lib/import/kickoffTime";

describe("UK kickoff time conversion", () => {
  it("converts local summer and winter kickoffs with the correct London offset", () => {
    expect(resolveKickoffInstant("2026-07-04", "15:00")).toEqual({
      ok: true,
      kickoffAt: "2026-07-04T14:00:00.000Z",
      timeBasis: "Europe/London"
    });
    expect(resolveKickoffInstant("2026-01-10", "15:00")).toEqual({
      ok: true,
      kickoffAt: "2026-01-10T15:00:00.000Z",
      timeBasis: "Europe/London"
    });
  });

  it("requires review for ambiguous and nonexistent local DST times", () => {
    expect(resolveKickoffInstant("2026-10-25", "01:30")).toEqual({ ok: false, reason: "ambiguous" });
    expect(resolveKickoffInstant("2026-03-29", "01:30")).toEqual({ ok: false, reason: "nonexistent" });
  });

  it("uses an explicit source offset to resolve an otherwise ambiguous time", () => {
    expect(resolveKickoffInstant("2026-10-25", "01:30", "+01:00")).toEqual({
      ok: true,
      kickoffAt: "2026-10-25T00:30:00.000Z",
      timeBasis: "+01:00"
    });
    expect(resolveKickoffInstant("2026-10-25", "01:30", "+00:00")).toEqual({
      ok: true,
      kickoffAt: "2026-10-25T01:30:00.000Z",
      timeBasis: "+00:00"
    });
  });

  it("derives local display fields from a source UTC instant", () => {
    expect(formatKickoffInLondon("2026-08-15T15:00:00Z")).toEqual({
      date: "2026-08-15",
      time: "16:00"
    });
    expect(formatKickoffInLondon("2026-01-10T15:00:00Z")).toEqual({
      date: "2026-01-10",
      time: "15:00"
    });
  });
});
