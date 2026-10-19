import { expect, test } from "@playwright/test";

test("standalone runtime serves SQLite health and executes a Server Action over HTTP", async ({ page, request }) => {
  test.skip(process.env.E2E_STANDALONE !== "1", "This smoke test targets the production standalone server.");

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ ok: true, db: true });

  await page.goto("/admin/login");
  await page.getByLabel("Admin secret").fill("playwright-runtime-smoke-admin");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const batchId = process.env.E2E_IMPORT_BATCH_ID;
  expect(batchId).toBeTruthy();
  await page.goto(`/admin/imports/${batchId}`);
  await expect(page.getByRole("heading", { name: `Batch #${batchId}` })).toBeVisible();
  await page.getByRole("button", { name: "Revalidate all" }).click();
  await expect(page.getByText(/Revalidated all 1 active rows/)).toBeVisible();
});
