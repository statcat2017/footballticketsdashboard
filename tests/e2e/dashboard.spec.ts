import { expect, test } from "@playwright/test";

test("search shows fixture demo results", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("nearme.fc")).toBeVisible();
  await expect(page.getByLabel("Postcode")).toBeVisible();

  await page.getByLabel("Postcode").fill("SW6 1HS");
  await page.getByRole("button", { name: "This weekend" }).click();

  await expect(page.locator(".fixtures")).toBeVisible();
  await expect(page.locator(".fixture-row").first()).toBeVisible();
});
