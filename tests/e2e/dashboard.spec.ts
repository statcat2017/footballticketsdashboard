import { expect, test } from "@playwright/test";
import type { FixtureResult } from "@/lib/types";

test("search shows fixture demo results", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("nearme.fc")).toBeVisible();
  await expect(page.getByLabel("Postcode")).toBeVisible();

  await page.getByLabel("Postcode").fill("SW6 1HS");
  await page.getByRole("button", { name: /All (dates|upcoming)/ }).click();

  await expect(page.locator(".desktop-table")).toBeVisible();
  await expect(page.locator(".fixture-row").first()).toBeVisible();
});

test("keeps the current heading until a postcode and radius are searched", async ({ page }) => {
  const submittedBodies: Array<Record<string, unknown>> = [];
  await page.route("**/api/search", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    submittedBodies.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [browserFixture],
        meta: { originSource: "known", radiusMiles: body.radiusMiles }
      })
    });
  });

  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main).toContainText("within 25 miles of SE20 7RS");

  await page.getByLabel("Postcode").fill("SW6 1HS");
  await page.getByLabel("Search radius").selectOption("50");
  await expect(main).toContainText("within 25 miles of SE20 7RS");

  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(main).toContainText("within 50 miles of SW6 1HS");
  expect(submittedBodies.at(-1)).toMatchObject({ postcode: "SW6 1HS", radiusMiles: 50 });
});

const browserFixture: FixtureResult = {
  id: 99001,
  title: "Chelsea vs Arsenal",
  competitionCode: "PL",
  competitionName: "Premier League",
  kickoffAt: "2099-05-15T14:00:00.000Z",
  fixtureDate: "2099-05-15",
  kickoffTime: "15:00",
  kickoffTimeStatus: "confirmed",
  seasonLabel: "2098-99",
  venueName: "Stamford Bridge",
  venuePostcode: "SW6 1HS",
  homeClub: "Chelsea",
  awayClub: "Arsenal",
  homeOneOff: false,
  awayOneOff: false,
  officialSiteUrl: "https://example.com/club",
  genericTicketUrl: null,
  price: {
    saleMode: "all_ticket",
    adultPricePence: 3000,
    concessionPricePence: null,
    sourceUrl: "https://example.com/prices",
    verifiedAt: "2099-05-01",
    confidence: "verified",
    isOverride: false,
    overrideNote: null
  },
  travel: {
    distanceMiles: 0,
    drivingMinutes: 10,
    publicTransportMinutes: null,
    publicTransportUrl: null,
    source: "distance_only"
  },
  isDemoData: false,
  isHistorical: false,
  warnings: []
};
