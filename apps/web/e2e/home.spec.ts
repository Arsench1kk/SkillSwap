import { expect, test } from "@playwright/test";

test("the blank project shell serves the SkillSwap title", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("SkillSwap");
  await expect(
    page.getByText(
      "SkillSwap connects you with a student who has handled a similar task, for one focused 45-minute session. Not a course, not paid tutoring.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Example" })).toBeVisible();
  await expect(page.getByText("Preview", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "I have a statistics assignment due Friday and I don't know how to interpret my regression output. I tried Excel but got stuck.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(page).toHaveURL(/#example$/);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1280);
});

test("the public example and preview fit a 360px viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Example" })).toBeVisible();
  await expect(page.getByText("Preview", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});

test("the language switcher updates copy and persists its choice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const languages = page.getByRole("group", { name: "Language" });
  await languages.getByRole("button", { name: "RU" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("heading", { name: "Пример" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Создать аккаунт" }),
  ).toBeVisible();

  await page
    .getByRole("group", { name: "Язык" })
    .getByRole("button", { name: "KK" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  await expect(page.getByRole("heading", { name: "Мысал" })).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  await expect(
    page.getByRole("link", { name: "Тіркелгі жасау" }),
  ).toBeVisible();
});
