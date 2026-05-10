import { expect, test } from "@playwright/test";

test("search shows fixture demo results", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Postcode").fill("SW6 1HS");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page.getByRole("heading", { name: /fixtures/i })).toBeVisible();
  await expect(page.getByText("Chelsea vs Arsenal")).toBeVisible();
  await expect(page.getByText("Queens Park Rangers vs Norwich City")).toBeVisible();
});
