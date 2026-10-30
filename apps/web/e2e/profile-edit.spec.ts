import { expect, test } from "@playwright/test";

test("profile separates viewing, saving and cancelling edits", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/prototype");
  await page.getByRole("button", { name: "My profile", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Arsen Abduhalyk", exact: true })).toBeVisible();
  await expect(page.getByLabel("Display name")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByLabel("Display name").fill("Unsaved change");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Arsen Abduhalyk", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByLabel("Display name").fill("Arsen A.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Arsen A.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit profile" }).click();
  await expect(page.getByLabel("Display name")).toHaveValue("Arsen A.");
});
