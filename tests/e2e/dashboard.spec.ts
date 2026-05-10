import { expect, test } from "@playwright/test";

test("search shows fixture demo results", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Non League Day / FWP pitch prototype")).toBeVisible();
  await expect(page.getByText(/Prices are best-effort club-level guidance/)).toBeVisible();

  await page.getByLabel("Postcode").fill("SW6 1HS");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page.getByText("Search results")).toBeVisible();
  await expect(page.getByRole("heading", { name: "2 fixtures" })).toBeVisible();
  await expect(page.getByText("Chelsea vs Arsenal")).toBeVisible();
  await expect(page.getByText("Queens Park Rangers vs Norwich City")).toBeVisible();
  await expect(page.getByText("Historical demo data").first()).toBeVisible();
  await expect(page.getByText("Prototype for non-league expansion")).toBeVisible();
});
