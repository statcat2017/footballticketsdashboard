import { describe, expect, it } from "vitest";

import { normalizePostcode, postcodeDistrict } from "@/lib/postcode";

describe("postcode helpers", () => {
  it("normalizes UK postcodes", () => {
    expect(normalizePostcode("sw61hs")).toBe("SW6 1HS");
  });

  it("extracts postcode districts", () => {
    expect(postcodeDistrict("SW6 1HS")).toBe("SW6");
  });
});
