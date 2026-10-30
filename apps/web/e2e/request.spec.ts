import { expect, test } from "@playwright/test";

test.describe("L1 learner request", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("shows the request form without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/request");
    await expect(page).toHaveTitle("SkillSwap");
    await expect(
      page.getByRole("heading", { name: "Tell us what you are stuck on" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("What exactly are you stuck on?"),
    ).toBeVisible();
    await expect(page.getByLabel("What have you already tried?")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send request" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });

  test("supports keyboard validation and keeps entered text on error", async ({
    page,
  }) => {
    await page.goto("/request");
    const task = page.getByLabel("What exactly are you stuck on?");
    await task.focus();
    await task.fill("My chart does not update when the source data changes.");
    await page.keyboard.press("Control+Enter").catch(() => undefined);
    await page.getByRole("button", { name: "Send request" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".ui-alert[role='alert']")).toContainText(
      "Check the highlighted fields and try again.",
    );
    await expect(task).toHaveValue(
      "My chart does not update when the source data changes.",
    );
  });

  test("allows adding and removing the optional third time window", async ({
    page,
  }) => {
    await page.goto("/request");
    await page.getByRole("button", { name: "Add another time" }).click();
    await expect(page.getByText("Time window 3")).toBeVisible();
    await page.getByRole("button", { name: "Remove third time" }).click();
    await expect(page.getByText("Time window 3")).toHaveCount(0);
  });
});
