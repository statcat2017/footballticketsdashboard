import { afterEach, describe, expect, it, vi } from "vitest";

import { adminUrl } from "@/lib/admin/redirect";

describe("admin redirect URL helper", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers APP_BASE_URL over the broken standalone request URL host", () => {
    vi.stubEnv("APP_BASE_URL", "https://fixtures.statcat.co.uk");

    const request = new Request("https://0.0.0.0:3000/api/admin/imports/1", {
      headers: {
        host: "0.0.0.0:3000",
      },
    });

    expect(adminUrl(request, "/admin/imports/1?success=ok").toString()).toBe(
      "https://fixtures.statcat.co.uk/admin/imports/1?success=ok"
    );
  });

  it("uses forwarded proxy headers when APP_BASE_URL is unset", () => {
    const request = new Request("https://0.0.0.0:3000/api/admin/imports/1", {
      headers: {
        "x-forwarded-host": "fixtures.statcat.co.uk",
        "x-forwarded-proto": "https",
      },
    });

    expect(adminUrl(request, "/admin/imports/1#fixture-1").toString()).toBe(
      "https://fixtures.statcat.co.uk/admin/imports/1#fixture-1"
    );
  });
});
