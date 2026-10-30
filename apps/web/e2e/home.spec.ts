import { expect, test } from "@playwright/test";

test("the blank project shell serves the SkillSwap title", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("SkillSwap");
});
