import { expect, test } from "@playwright/test";

test("search ranks nearby football tickets", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Postcode").fill("M16 0RA");
  await page.getByLabel("Age").fill("65");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page.getByRole("heading", { name: /ranked results/i })).toBeVisible();
  await expect(page.getByText("Manchester United vs Brighton & Hove Albion")).toBeVisible();
  await expect(page.getByText("concession price applied").first()).toBeVisible();
});
