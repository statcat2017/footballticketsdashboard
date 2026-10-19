import { expect, test } from "@playwright/test";

test("search explains fixture status and caveats without unsafe ticket actions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("nearme.fc")).toBeVisible();
  await expect(page.getByLabel("Postcode")).toBeVisible();

  const searchResponse = page.waitForResponse((response) => {
    if (!response.url().endsWith("/api/search") || response.request().method() !== "POST") return false;
    const request = response.request().postDataJSON() as { dateTo?: string };
    return request.dateTo !== undefined && Date.parse(request.dateTo) > Date.now() + 30 * 24 * 60 * 60 * 1000;
  });
  await page.getByLabel("Postcode").fill("N5 1BU");
  await page.getByRole("button", { name: "All dates" }).click();
  const response = await searchResponse;
  const payload = await response.json() as { results: Array<{ title: string; fixtureStatus: string; genericTicketUrl: string | null; warnings: string[]; travel: { source: string; publicTransportMinutes: number | null } }> };

  expect(payload.results.map((fixture) => fixture.fixtureStatus).sort()).toEqual([
    "cancelled", "postponed", "scheduled", "scheduled", "scheduled", "unknown"
  ]);
  expect(payload.results.map((fixture) => fixture.title)).toContain("Chelsea vs Already Started Opponent");
  expect(payload.results.map((fixture) => fixture.title)).toContain("No Price Home vs No Price Away");
  expect(payload.results.map((fixture) => fixture.title)).not.toContain("Chelsea vs Finished Opponent");
  expect(payload.results.filter((fixture) => fixture.fixtureStatus !== "scheduled").every((fixture) => fixture.genericTicketUrl !== null)).toBe(true);
  expect(payload.results.every((fixture) => fixture.travel.source === "distance_only" && fixture.travel.publicTransportMinutes === null)).toBe(true);

  await expect(page.locator(".desktop-table")).toBeVisible();
  await expect(page.locator(".featured")).toContainText("Already started");
  await expect(page.locator(".featured")).toContainText("Demo fixture data; details may be illustrative.");
  await expect(page.locator(".featured-actions a")).toHaveCount(0);
  await expect(page.getByText("Kick-off time is not confirmed.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Postponed", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Status unconfirmed", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Admission prices are best-effort guide prices", { exact: false })).toHaveCount(1);
  await expect(page.getByText("Kick-off time is assumed; confirm with the club.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Venue location may be approximate; confirm the ground before travelling.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Admission price is not confirmed.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Travel time unavailable for this postcode district; showing straight-line distance only.", { exact: true }).first()).toBeVisible();

  for (const name of ["Already Started Opponent", "Postponed Opponent", "Cancelled Opponent", "Unknown Status Opponent"]) {
    const row = page.locator(".fixture-row").filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.locator(".row-action a")).toHaveCount(0);
  }

  await expect(page.getByRole("link", { name: "Check club tickets" }).first()).toBeVisible();

  await page.setViewportSize({ width: 360, height: 844 });
  await expect(page.locator(".mobile-cards")).toBeVisible();
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(360);
  const activeTicketBox = await page.getByRole("link", { name: "Check club tickets" }).first().boundingBox();
  expect(activeTicketBox?.height).toBeGreaterThanOrEqual(44);
  for (const [name, caveat] of [
    ["Already Started Opponent", "Demo fixture data; details may be illustrative."],
    ["Postponed Opponent", "Kick-off time is assumed; confirm with the club."],
    ["Cancelled Opponent", "Venue location may be approximate; confirm the ground before travelling."],
    ["Unknown Status Opponent", "Kick-off time is not confirmed."],
    ["No Price Away", "Admission price is not confirmed."]
  ]) {
    const card = page.locator(".fixture-card").filter({ hasText: name });
    await expect(card).toBeVisible();
    await expect(card.locator("a.fixture-card-action")).toHaveCount(0);
    await expect(card).toContainText(caveat);
  }
});
