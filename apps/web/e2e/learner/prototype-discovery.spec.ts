import { expect, test } from "@playwright/test";

test("mentor discovery preserves demo filters and saved profiles at 360px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 850 });
  await page.route("**/api/auth/get-session*", (route) =>
    route.fulfill({ json: null }),
  );
  await page.goto("/prototype");
  await page.getByRole("button", { name: "Find a mentor" }).last().click();

  const results = page.getByRole("article");
  await expect(results).toHaveCount(4);
  await page
    .getByRole("button", { name: "Design", exact: true })
    .press("Enter");
  await expect(results).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Mira B." })).toBeVisible();

  await page
    .getByRole("button", { name: "Save mentor", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: /^Saved/ }).press("Enter");
  await expect(results).toHaveCount(1);
  await page
    .getByRole("button", { name: "Remove from saved mentors" })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "No sample mentors found" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).press("Enter");
  await expect(results).toHaveCount(4);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});
