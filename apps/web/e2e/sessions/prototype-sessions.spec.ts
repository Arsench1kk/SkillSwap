import { expect, test } from "@playwright/test";

test("workspace demo sessions stay usable on mobile after navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/prototype");

  const navigation = page.getByRole("navigation", {
    name: "Workspace navigation",
  });
  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  const openSessions = async () => {
    await openNavigation.click();
    await navigation.getByRole("button", { name: "Sessions" }).click();
  };

  await openSessions();
  await expect(page.getByRole("note")).toHaveText(
    "Preview mode · sample content only · changes are not saved",
  );
  await expect(
    page.getByRole("heading", { name: "Make your first data dashboard" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open meeting" }).press("Enter");
  await expect(
    page.getByText("Demo meeting link — no external meeting is opened."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Past 2" }).press("Enter");
  await expect(
    page.getByText("Fix a Python chart that returned no data"),
  ).toBeVisible();
  await openNavigation.click();
  await navigation.getByRole("button", { name: "Home" }).click();
  await openSessions();
  await expect(
    page.getByText("Fix a Python chart that returned no data"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Open meeting" })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});
