import { expect, test } from "@playwright/test";

test("search displays exact admission prices with evidence and preserves price precedence", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("nearme.fc")).toBeVisible();
  await expect(page.getByLabel("Postcode")).toBeVisible();

  await page.getByLabel("Postcode").fill("ZZ1 1ZZ");
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/search")
      && response.request().method() === "POST"
      && Date.parse((response.request().postDataJSON() as { dateTo?: string }).dateTo ?? "") > Date.now() + 30 * 24 * 60 * 60 * 1000
  );
  await page.getByRole("button", { name: "All dates" }).click();
  const response = await responsePromise;
  const payload = await response.json() as { results: Array<{
    id: number;
    title: string;
    genericTicketUrl: string | null;
    seasonLabel: string | null;
    price: {
      adultPricePence: number | null;
      concessionPricePence: number | null;
      sourceUrl: string | null;
      verifiedAt: string | null;
      confidence: string;
      isOverride: boolean;
      seasonLabel: string | null;
      confirmation: { required: boolean; maxAgeDays: number; reasons: string[] };
      adultEvidence: {
        sourceUrl: string | null;
        verifiedAt: string | null;
        confidence: string;
        seasonLabel: string | null;
        isOverride: boolean;
        confirmation: { required: boolean; maxAgeDays: number; reasons: string[] };
      } | null;
      concessionEvidence: {
        sourceUrl: string | null;
        verifiedAt: string | null;
        confidence: string;
        seasonLabel: string | null;
        isOverride: boolean;
        confirmation: { required: boolean; maxAgeDays: number; reasons: string[] };
      } | null;
    };
    travel: { source: string };
  }> };

  const overrideFixture = payload.results.find((result) => result.title === "Chelsea vs Arsenal");
  const defaultFixture = payload.results.find((result) => result.title === "Chelsea vs Queens Park Rangers");
  const staleFixture = payload.results.find((result) => result.title === "Chelsea vs Birmingham City");
  const missingPriceFixture = payload.results.find((result) => result.title === "No Price Home vs No Price Away");
  const missingCheckedDateFixture = payload.results.find((result) => result.title === "No Check Home vs No Check Away");
  expect(overrideFixture?.price).toMatchObject({
    adultPricePence: 1250,
    concessionPricePence: 2000,
    sourceUrl: "https://prices.example.test/chelsea/e2e-live",
    confidence: "verified",
    isOverride: true,
    verifiedAt: null,
    seasonLabel: null,
    confirmation: { required: true, maxAgeDays: 90, reasons: ["missing_checked_date"] }
  });
  expect(overrideFixture?.price.adultEvidence).toMatchObject({
    sourceUrl: "https://prices.example.test/chelsea/e2e-live",
    verifiedAt: null,
    isOverride: true,
    confirmation: { required: true, reasons: ["missing_checked_date"] }
  });
  expect(overrideFixture?.price.concessionEvidence).toMatchObject({
    sourceUrl: "https://www.chelseafc.com/en/tickets",
    verifiedAt: "2026-05-10",
    seasonLabel: "2025-26",
    isOverride: false,
    confirmation: {
      required: true,
      reasons: expect.arrayContaining(["older_than_threshold", "different_season"])
    }
  });
  expect(overrideFixture?.genericTicketUrl).toBe("https://www.chelseafc.com/en/tickets");
  expect(defaultFixture?.price).toMatchObject({
    adultPricePence: 3000,
    concessionPricePence: 2000,
    sourceUrl: "https://www.chelseafc.com/en/tickets",
    isOverride: false,
    seasonLabel: "2025-26",
    confirmation: { required: true, maxAgeDays: 90, reasons: expect.arrayContaining(["different_season"]) }
  });
  expect(staleFixture?.price.confirmation).toEqual({
    required: true,
    maxAgeDays: 90,
    reasons: ["older_than_threshold"]
  });
  expect(missingPriceFixture?.price).toMatchObject({
    adultPricePence: null,
    concessionPricePence: null,
    sourceUrl: null,
    confidence: "unknown",
    confirmation: { required: true, maxAgeDays: 90, reasons: ["missing_checked_date"] }
  });
  expect(missingCheckedDateFixture?.price).toMatchObject({
    adultPricePence: 900,
    verifiedAt: null,
    sourceUrl: "https://prices.example.test/one-off/no-check",
    confirmation: { required: true, maxAgeDays: 90, reasons: ["missing_checked_date"] }
  });
  expect(payload.results.every((result) => result.travel.source === "distance_only")).toBe(true);

  await expect(page.locator(".desktop-table")).toBeVisible();
  await expect(page.locator(".featured-price-evidence")).toContainText("Adult £12.50");
  await expect(page.locator(".featured-price-evidence").getByRole("link", { name: "Adult price source" })).toHaveAttribute(
    "href",
    "https://prices.example.test/chelsea/e2e-live"
  );
  await expect(page.locator(".featured-price-evidence")).toContainText("Verified confidence");
  await expect(page.locator(".featured-price-evidence")).toContainText("No checked date recorded");
  await expect(page.locator(".featured-price-evidence")).toContainText("Price season not recorded");
  await expect(page.locator(".featured-price-evidence .price-confirmation").filter({ hasText: "No valid checked date is recorded" })).toContainText("Confirm adult price");

  const overrideRow = page.locator(".fixture-row").filter({ hasText: "Chelsea vs Arsenal" });
  await expect(overrideRow).toContainText("£12.50");
  await expect(overrideRow).toContainText("£20.00");
  await expect(overrideRow.getByRole("link", { name: "Adult price source" })).toHaveAttribute(
    "href",
    "https://prices.example.test/chelsea/e2e-live"
  );
  const concessionEvidence = overrideRow.locator(".price-evidence-item").filter({ hasText: "Concession £20.00" });
  await expect(concessionEvidence).toContainText("Checked 10 May 2026");
  await expect(concessionEvidence).toContainText("Price season 2025-26");
  await expect(concessionEvidence.getByRole("link", { name: "Concession price source" })).toHaveAttribute(
    "href",
    "https://www.chelseafc.com/en/tickets"
  );
  await expect(concessionEvidence.locator(".price-confirmation")).toContainText("Checked more than 90 days ago");
  await expect(overrideRow.getByRole("link", { name: "Tickets" })).toHaveAttribute(
    "href",
    "https://www.chelseafc.com/en/tickets"
  );

  const defaultRow = page.locator(".fixture-row").filter({ hasText: "Chelsea vs Queens Park Rangers" });
  await expect(defaultRow).toContainText("£30.00");
  await expect(defaultRow).toContainText("£20.00");
  const defaultAdultEvidence = defaultRow.locator(".price-evidence-item").filter({ hasText: "Adult £30.00" });
  await expect(defaultAdultEvidence.locator(".price-confirmation")).toContainText("differs from fixture season 2026-27");

  const staleRow = page.locator(".fixture-row").filter({ hasText: "Chelsea vs Birmingham City" });
  const staleAdultEvidence = staleRow.locator(".price-evidence-item").filter({ hasText: "Adult £25.00" });
  await expect(staleAdultEvidence.locator(".price-confirmation")).toContainText("Checked more than 90 days ago");

  const missingPriceRow = page.locator(".fixture-row").filter({ hasText: "No Price Home vs No Price Away" });
  await expect(missingPriceRow).toContainText("Adult TBC");
  await expect(missingPriceRow).toContainText("Concession TBC");
  await expect(missingPriceRow).toContainText("No checked date recorded");
  await expect(missingPriceRow).toContainText("Price source unavailable");
  await expect(missingPriceRow.locator(".price-confirmation")).toContainText("No valid checked date is recorded");

  const missingCheckedDateRow = page.locator(".fixture-row").filter({ hasText: "No Check Home vs No Check Away" });
  await expect(missingCheckedDateRow).toContainText("Adult £9.00");
  await expect(missingCheckedDateRow.getByRole("link", { name: "Adult price source" })).toHaveAttribute(
    "href",
    "https://prices.example.test/one-off/no-check"
  );

  await page.setViewportSize({ width: 360, height: 844 });
  await expect(page.locator(".mobile-cards")).toBeVisible();
  const mobileOverride = page.locator(".fixture-card").filter({ hasText: "Chelsea vs Arsenal" });
  await expect(mobileOverride).toContainText("Adult £12.50");
  await expect(mobileOverride).toContainText("Verified confidence");
  await expect(mobileOverride.getByRole("link", { name: "Adult price source" })).toHaveAttribute(
    "href",
    "https://prices.example.test/chelsea/e2e-live"
  );
});
