import { describe, expect, it } from "vitest";

import { normalizePostcode } from "@/lib/postcode";

describe("normalizePostcode", () => {
  it("normalizes compact UK postcodes", () => {
    expect(normalizePostcode("m160ra")).toBe("M16 0RA");
  });

  it("rejects clearly invalid input", () => {
    expect(() => normalizePostcode("abc")).toThrow("Enter a valid UK postcode.");
  });
});
