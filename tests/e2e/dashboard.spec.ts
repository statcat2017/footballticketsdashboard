import { expect, test } from "@playwright/test";

test("search shows fixture demo results", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("nearme.fc")).toBeVisible();
  await expect(page.getByLabel("Postcode")).toBeVisible();

  await page.getByLabel("Postcode").fill("SW6 1HS");
  await page.getByRole("button", { name: "All dates" }).click();

  await expect(page.locator(".desktop-table")).toBeVisible();
  await expect(page.locator(".desktop-table .fixture-row").first()).toBeVisible();
});
