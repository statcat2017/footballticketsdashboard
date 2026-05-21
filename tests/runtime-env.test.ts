import { afterEach, describe, expect, it, vi } from "vitest";

interface CloudflareError extends Error {
  code?: string;
}

const MISSING_CONTEXT_CODE = "ERR_MISSING_CLOUDFLARE_CONTEXT";

const { getCloudflareContextMock } = vi.hoisted(() => ({
  getCloudflareContextMock: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", async () => {
  const actual = await vi.importActual<typeof import("@opennextjs/cloudflare")>("@opennextjs/cloudflare");
  return { ...actual, getCloudflareContext: getCloudflareContextMock };
});

describe("getCloudflareEnv", () => {
  afterEach(() => {
    getCloudflareContextMock.mockReset();
    delete process.env.TEST_KEY;
  });

  it("returns value from Cloudflare env", async () => {
    getCloudflareContextMock.mockResolvedValue({ env: { TEST_KEY: "cf-value" } });

    const { getCloudflareEnv } = await import("@/lib/runtime-env");
    const result = await getCloudflareEnv("TEST_KEY");
    expect(result).toBe("cf-value");
  });

  it("falls back to process.env when Cloudflare context is missing (error code)", async () => {
    const err = new Error("not available") as CloudflareError;
    err.code = MISSING_CONTEXT_CODE;
    getCloudflareContextMock.mockRejectedValue(err);

    process.env.TEST_KEY = "env-value";

    const { getCloudflareEnv } = await import("@/lib/runtime-env");
    const result = await getCloudflareEnv("TEST_KEY");
    expect(result).toBe("env-value");
  });

  it("falls back to process.env when error message includes getCloudflareContext", async () => {
    getCloudflareContextMock.mockRejectedValue(new Error("getCloudflareContext failed: no binding"));

    process.env.TEST_KEY = "fallback";

    const { getCloudflareEnv } = await import("@/lib/runtime-env");
    const result = await getCloudflareEnv("TEST_KEY");
    expect(result).toBe("fallback");
  });

  it("re-throws non-Cloudflare errors", async () => {
    getCloudflareContextMock.mockRejectedValue(new Error("DB connection failed"));

    const { getCloudflareEnv } = await import("@/lib/runtime-env");
    await expect(getCloudflareEnv("TEST_KEY")).rejects.toThrow("DB connection failed");
  });

  it("returns undefined when both Cloudflare and process.env are missing", async () => {
    const err = new Error("missing") as CloudflareError;
    err.code = MISSING_CONTEXT_CODE;
    getCloudflareContextMock.mockRejectedValue(err);

    const { getCloudflareEnv } = await import("@/lib/runtime-env");
    const result = await getCloudflareEnv("MISSING_KEY");
    expect(result).toBeUndefined();
  });
});

describe("getTravelProviderRuntimeConfig", () => {
  afterEach(() => {
    getCloudflareContextMock.mockReset();
    delete process.env.OPENROUTESERVICE_API_KEY;
    delete process.env.TRAVELTIME_APP_ID;
    delete process.env.TRAVELTIME_API_KEY;
  });

  it("returns config from Cloudflare env", async () => {
    getCloudflareContextMock.mockResolvedValue({
      env: {
        OPENROUTESERVICE_API_KEY: "ors-cf",
        TRAVELTIME_APP_ID: "tt-cf",
        TRAVELTIME_API_KEY: "tt-key-cf",
      },
    });

    const { getTravelProviderRuntimeConfig } = await import("@/lib/runtime-env");
    const config = await getTravelProviderRuntimeConfig();
    expect(config).toEqual({
      openRouteServiceApiKey: "ors-cf",
      travelTimeAppId: "tt-cf",
      travelTimeApiKey: "tt-key-cf",
    });
  });

  it("falls back to process.env when Cloudflare context is missing", async () => {
    const err = new Error("getCloudflareContext not available") as CloudflareError;
    err.code = MISSING_CONTEXT_CODE;
    getCloudflareContextMock.mockRejectedValue(err);

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

  it("falls back to partial process.env when some Cloudflare keys are missing", async () => {
    const err = new Error("getCloudflareContext missing") as CloudflareError;
    err.code = MISSING_CONTEXT_CODE;
    getCloudflareContextMock.mockRejectedValue(err);

    process.env.OPENROUTESERVICE_API_KEY = "ors-only";

    const { getTravelProviderRuntimeConfig } = await import("@/lib/runtime-env");
    const config = await getTravelProviderRuntimeConfig();
    expect(config).toEqual({
      openRouteServiceApiKey: "ors-only",
      travelTimeAppId: undefined,
      travelTimeApiKey: undefined,
    });
  });

  it("re-throws non-Cloudflare errors", async () => {
    getCloudflareContextMock.mockRejectedValue(new Error("Network failure"));

    const { getTravelProviderRuntimeConfig } = await import("@/lib/runtime-env");
    await expect(getTravelProviderRuntimeConfig()).rejects.toThrow("Network failure");
  });
});
