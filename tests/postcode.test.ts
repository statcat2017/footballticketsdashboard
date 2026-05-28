import { describe, expect, it, vi } from "vitest";

import { normalizePostcode, tryNormalizePostcode, postcodeCoordinate, postcodeDistrict, resolvePostcodeOrigin } from "@/lib/postcode";

describe("postcode helpers", () => {
  it("normalizes UK postcodes", () => {
    expect(normalizePostcode("sw61hs")).toBe("SW6 1HS");
  });

  it("throws for empty input", () => {
    expect(() => normalizePostcode("")).toThrow("Enter a valid UK postcode.");
  });

  it("throws for very short input", () => {
    expect(() => normalizePostcode("A1")).toThrow("Enter a valid UK postcode.");
  });

  it("throws for very long input", () => {
    expect(() => normalizePostcode("ABCDEFGHIJKLMNOP")).toThrow("Enter a valid UK postcode.");
  });

  it("throws for invalid input", () => {
    expect(() => normalizePostcode("abc")).toThrow("Enter a valid UK postcode.");
  });

  describe("tryNormalizePostcode", () => {
    it("returns normalized postcode for valid input", () => {
      expect(tryNormalizePostcode("sw61hs")).toBe("SW6 1HS");
    });

    it("returns null for empty input", () => {
      expect(tryNormalizePostcode("")).toBeNull();
    });

    it("returns null for invalid input", () => {
      expect(tryNormalizePostcode("abc")).toBeNull();
    });
  });

  it("extracts postcode districts", () => {
    expect(postcodeDistrict("SW6 1HS")).toBe("SW6");
  });

  it("uses area-based fallback coordinates for unknown but nearby postcodes", () => {
    expect(postcodeCoordinate("B75 5AQ")).toEqual({
      latitude: 52.497718,
      longitude: -1.9040670000000002
    });
  });

  it("uses postcodes.io coordinates when available", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      result: {
        latitude: 52.549,
        longitude: -1.816
      }
    }), { status: 200 }));

    await expect(resolvePostcodeOrigin("B75 5AQ", fetchImpl as typeof fetch)).resolves.toEqual({
      normalized: "B75 5AQ",
      district: "B75",
      coordinate: {
        latitude: 52.549,
        longitude: -1.816
      },
      source: "api"
    });
  });
});
