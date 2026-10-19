import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/auth", () => ({
  requireAdminPageSession: async () => ({ actor: "test-operator" }),
}));

vi.mock("@/lib/admin/csrf", () => ({
  createAdminCsrfToken: async () => "test-token",
}));

import AdminDashboardPage from "@/app/admin/page";

describe("admin competition management navigation", () => {
  it("links to the general competition category editor from the admin dashboard", async () => {
    const markup = renderToStaticMarkup(await AdminDashboardPage());

    expect(markup).toContain('href="/admin/competitions"');
    expect(markup).toContain("Manage competitions");
  });
});
