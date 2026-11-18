import { expect, test } from "@playwright/test";

test("demo profile preserves saved edits and cancels navigation drafts at 360px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 850 });
  await page.route("**/api/auth/get-session*", (route) =>
    route.fulfill({ json: null }),
  );
  await page.goto("/prototype");
  const navigation = page.getByRole("navigation", {
    name: "Workspace navigation",
  });
  const openProfile = async () => {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await navigation
      .getByRole("button", { name: "My profile", exact: true })
      .click();
  };
  await openProfile();
  await page.getByRole("button", { name: "Edit profile" }).press("Enter");
  await page.getByLabel("Display name").fill("Saved demo profile");
  await page
    .getByRole("button", { name: "Add skill", exact: true })
    .press("Enter");
  await page.getByLabel("Type a skill").fill("Test diagrams");
  await page.getByRole("button", { name: "Add", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Save changes" }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "Saved demo profile" }),
  ).toBeVisible();
  await expect(page.getByText("Test diagrams", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit profile" }).press("Enter");
  await page.getByLabel("Display name").fill("Discarded name");
  await page
    .getByRole("button", { name: /Remove.*Test diagrams/ })
    .press("Enter");
  await page
    .getByRole("button", { name: "Cancel", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "Saved demo profile" }),
  ).toBeVisible();
  await expect(page.getByText("Test diagrams", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit profile" }).press("Enter");
  await page.getByLabel("Display name").fill("Discarded by navigation");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await navigation.getByRole("button", { name: "Home", exact: true }).click();
  await openProfile();
  await expect(
    page.getByRole("heading", { name: "Saved demo profile" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});
