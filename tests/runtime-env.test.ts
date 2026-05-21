import { afterEach, describe, expect, it } from "vitest";

describe("getCloudflareEnv", () => {
  afterEach(() => {
    delete process.env.TEST_KEY;
  });

  it("returns value from process.env", async () => {
    process.env.TEST_KEY = "env-value";

    const { getCloudflareEnv } = await import("@/lib/runtime-env");
    const result = await getCloudflareEnv("TEST_KEY");
    expect(result).toBe("env-value");
  });

  it("returns undefined when key is not set", async () => {
    const { getCloudflareEnv } = await import("@/lib/runtime-env");
    const result = await getCloudflareEnv("MISSING_KEY");
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
