import { expect, test } from "@playwright/test";

test("search shows fixture demo results", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Non League Day / FWP pitch prototype")).toBeVisible();
  await expect(page.getByText(/Prices are best-effort club-level guidance/)).toBeVisible();

  await page.getByLabel("Postcode").fill("SW6 1HS");
  await page.getByRole("button", { name: "Refresh" }).click();

  await expect(page.getByText("Search results")).toBeVisible();
  await expect(page.getByText("Chelsea vs Tottenham Hotspur")).toBeVisible();
  await expect(page.getByText("Historical demo data")).toHaveCount(0);
  await expect(page.getByText("Prototype for non-league expansion")).toBeVisible();
});
