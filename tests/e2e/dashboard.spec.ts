import { expect, test } from "@playwright/test";

test("normal search stays current and historical samples require an explicit demo search", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("nearme.fc")).toBeVisible();
  await expect(page.getByLabel("Postcode")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next 14 days" })).toBeVisible();

  await page.getByLabel("Postcode").fill("SW6 1HS");
  await page.getByLabel("Postcode").press("Enter");

  const currentResults = page.locator(".desktop-table .fixture-row");
  await expect(currentResults).toHaveCount(1);
  await expect(currentResults.first()).toContainText("Chelsea vs Arsenal");
  await expect(page.locator(".desktop-table .demo-label")).toHaveCount(0);

  await page.getByRole("button", { name: "Show demo fixtures" }).click();

  await expect(page.getByText("Historical demo fixtures")).toBeVisible();
  await expect(page.getByText(/Sample period: .*2025/)).toBeVisible();
  await expect(page.locator(".desktop-table .demo-label")).toHaveCount(4);
  await expect(page.getByRole("link", { name: "Get tickets" })).toHaveCount(0);
});

test("date filters submit UK calendar windows across weekdays and timezone boundaries", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-19T12:00:00.000Z") });
  const initialSearch = page.waitForResponse((response) =>
    response.url().endsWith("/api/search") && response.request().method() === "POST"
  );
  await page.goto("/");
  const initialResponse = await initialSearch;
  expect(initialResponse.ok()).toBeTruthy();
  expect(initialResponse.request().postDataJSON()).toMatchObject({
    dateFrom: "2026-10-19",
    dateTo: "2026-11-01"
  });
  await expect(page.getByText("nearme.fc")).toBeVisible();

  await assertSearchRange(page, "All dates", ["2026-10-19", "2027-10-19"]);

  const cases = [
    { day: "Monday", now: "2026-10-19T12:00:00.000Z", thisWeekend: ["2026-10-23", "2026-10-25"], nextWeekend: ["2026-10-30", "2026-11-01"] },
    { day: "Tuesday", now: "2026-10-20T12:00:00.000Z", thisWeekend: ["2026-10-23", "2026-10-25"], nextWeekend: ["2026-10-30", "2026-11-01"] },
    { day: "Wednesday", now: "2026-10-21T12:00:00.000Z", thisWeekend: ["2026-10-23", "2026-10-25"], nextWeekend: ["2026-10-30", "2026-11-01"] },
    { day: "Thursday", now: "2026-10-22T12:00:00.000Z", thisWeekend: ["2026-10-23", "2026-10-25"], nextWeekend: ["2026-10-30", "2026-11-01"] },
    { day: "Friday", now: "2026-10-23T12:00:00.000Z", thisWeekend: ["2026-10-23", "2026-10-25"], nextWeekend: ["2026-10-30", "2026-11-01"] },
    { day: "Saturday", now: "2026-10-24T12:00:00.000Z", thisWeekend: ["2026-10-24", "2026-10-25"], nextWeekend: ["2026-10-30", "2026-11-01"] },
    { day: "Sunday", now: "2026-10-25T12:00:00.000Z", thisWeekend: ["2026-10-25", "2026-10-25"], nextWeekend: ["2026-10-30", "2026-11-01"] },
    { day: "UK midnight", now: "2026-10-22T23:30:00.000Z", thisWeekend: ["2026-10-23", "2026-10-25"], nextWeekend: ["2026-10-30", "2026-11-01"] },
    { day: "spring clock change", now: "2026-03-29T00:30:00.000Z", thisWeekend: ["2026-03-29", "2026-03-29"], nextWeekend: ["2026-04-03", "2026-04-05"] },
    { day: "year boundary", now: "2026-12-31T12:00:00.000Z", thisWeekend: ["2027-01-01", "2027-01-03"], nextWeekend: ["2027-01-08", "2027-01-10"] }
  ] as const;

  for (const testCase of cases) {
    await page.clock.setFixedTime(new Date(testCase.now));
    await assertSearchRange(page, "This weekend", testCase.thisWeekend);
    await assertSearchRange(page, "Next weekend", testCase.nextWeekend);
  }
});

async function assertSearchRange(
  page: import("@playwright/test").Page,
  filterName: string,
  [dateFrom, dateTo]: readonly [string, string]
): Promise<void> {
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/search") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: filterName }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const body = response.request().postDataJSON() as { dateFrom: string; dateTo: string };
  expect(body).toMatchObject({ dateFrom, dateTo });
}
