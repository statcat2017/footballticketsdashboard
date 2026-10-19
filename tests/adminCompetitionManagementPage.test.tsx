import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  competitions: [{
    code: "UNCAT_TEST",
    name: "Uncategorized Competition",
    kind: "league",
    public_category: "uncategorized",
  }],
}));

vi.mock("@/lib/admin/auth", () => ({
  requireAdminPageSession: async () => ({ actor: "test-operator" }),
  getAdminSessionFromCookies: async () => ({ actor: "test-operator" }),
}));

vi.mock("@/lib/db/client", () => ({
  getDatabase: async () => ({ all: async () => testState.competitions }),
}));

vi.mock("@/app/admin/imports/[id]/actions", () => ({
  updateCompetitionCategoryFromAdmin: async () => ({ success: "Saved." }),
}));

import AdminCompetitionsPage from "@/app/admin/competitions/page";

describe("admin competition category management", () => {
  it("shows an editor for existing uncategorized competitions without an import issue", async () => {
    const markup = renderToStaticMarkup(await AdminCompetitionsPage());

    expect(markup).toContain("Competition categories");
    expect(markup).toContain("Uncategorized Competition");
    expect(markup).toContain("UNCAT_TEST");
    expect(markup).toContain("Public category");
    expect(markup).toContain("Save category");
    expect(markup).toContain('value="uncategorized" selected=""');
  });
});
