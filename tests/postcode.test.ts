import { describe, expect, it, vi } from "vitest";

import { normalizePostcode, postcodeCoordinate, postcodeDistrict, resolvePostcodeOrigin } from "@/lib/postcode";

describe("postcode helpers", () => {
  it("normalizes UK postcodes", () => {
    expect(normalizePostcode("sw61hs")).toBe("SW6 1HS");
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
