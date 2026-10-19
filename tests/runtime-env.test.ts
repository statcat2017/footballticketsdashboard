import { afterEach, describe, expect, it } from "vitest";

describe("getEnv", () => {
  afterEach(() => {
    delete process.env.TEST_KEY;
  });

  it("returns value from process.env", async () => {
    process.env.TEST_KEY = "env-value";

    const { getEnv } = await import("@/lib/runtime-env");
    const result = getEnv("TEST_KEY");
    expect(result).toBe("env-value");
  });

  it("returns undefined when key is not set", async () => {
    const { getEnv } = await import("@/lib/runtime-env");
    const result = getEnv("MISSING_KEY");
    expect(result).toBeUndefined();
  });
});

describe("getTravelProviderRuntimeConfig", () => {
  afterEach(() => {
    delete process.env.OPENROUTESERVICE_API_KEY;
    delete process.env.TRAVELTIME_APP_ID;
    delete process.env.TRAVELTIME_API_KEY;
  });

  it("returns config from process.env", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "ors-env";
    process.env.TRAVELTIME_APP_ID = "tt-env";
    process.env.TRAVELTIME_API_KEY = "tt-key-env";

    const { getTravelProviderRuntimeConfig } = await import("@/lib/runtime-env");
    const config = await getTravelProviderRuntimeConfig();
    expect(config).toEqual({
      openRouteServiceApiKey: "ors-env",
      travelTimeAppId: "tt-env",
      travelTimeApiKey: "tt-key-env",
    });
  });

  it("returns partial config when some keys are missing", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "ors-only";

    const { getTravelProviderRuntimeConfig } = await import("@/lib/runtime-env");
    const config = await getTravelProviderRuntimeConfig();
    expect(config).toEqual({
      openRouteServiceApiKey: "ors-only",
      travelTimeAppId: undefined,
      travelTimeApiKey: undefined,
    });
  });
});

describe("getPriceConfirmationPolicy", () => {
  afterEach(() => {
    delete process.env.PRICE_CONFIRMATION_MAX_AGE_DAYS;
  });

  it("defaults to the documented 90-day confirmation policy", async () => {
    const { getPriceConfirmationPolicy } = await import("@/lib/runtime-env");
    expect(getPriceConfirmationPolicy()).toEqual({ maxAgeDays: 90 });
  });

  it("accepts a configured integer age threshold", async () => {
    process.env.PRICE_CONFIRMATION_MAX_AGE_DAYS = "45";
    const { getPriceConfirmationPolicy } = await import("@/lib/runtime-env");
    expect(getPriceConfirmationPolicy()).toEqual({ maxAgeDays: 45 });
  });

  it("uses the default policy for invalid configuration", async () => {
    process.env.PRICE_CONFIRMATION_MAX_AGE_DAYS = "many";
    const { getPriceConfirmationPolicy } = await import("@/lib/runtime-env");
    expect(getPriceConfirmationPolicy()).toEqual({ maxAgeDays: 90 });
  });
});
