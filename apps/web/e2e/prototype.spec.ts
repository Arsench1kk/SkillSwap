import { expect, test } from "@playwright/test";

for (const width of [360, 1440]) {
  test(`mentor skills stay readable and searchable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/prototype");
    await page.getByRole("button", { name: "Find a mentor", exact: true }).last().click();
    const search = page.getByRole("textbox", { name: "Search a skill, topic, or tool" });
    await search.fill("figma");
    await expect(page.getByText("Can help with", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mira B." })).toBeVisible();
    await page.getByRole("button", { name: "View profile" }).click();
    await expect(page.getByText("Can help with", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask this mentor" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("prototype demonstrates the learner and mentor journeys on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/prototype");

  await expect(page.getByText("Prototype preview")).toHaveCount(0);
  await expect(
    page.getByText("Interactive concept · sample data · changes are not saved"),
  ).toHaveCount(0);
  await expect(page.getByText("Sample data · demo only")).toBeVisible();
  await expect(page.locator("#next-logo")).toHaveCount(0);

  await expect(
    page.getByRole("heading", { name: "What would you like help with?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Find a mentor" }).last().click();
  await page
    .getByRole("textbox", { name: "Search a skill, topic, or tool" })
    .fill("figma");
  await expect(page.getByRole("heading", { name: "Mira B." })).toBeVisible();
  await expect(page.getByText("Can help with", { exact: true })).toBeVisible();
  await expect(page.getByText("Wants to learn", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "View profile" }).click();
  await expect(page.getByRole("heading", { name: "Mira B." })).toBeVisible();
  await expect(page.getByText("Can help with", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ask this mentor" }).click();
  await page
    .getByLabel("Your task")
    .fill("I need a second pair of eyes on this layout.");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(
    page.getByText(
      "Request sent to the team. Your preferred mentor has not been contacted yet.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Mentor", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "A focused request, when you have time.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "I can help" }).first().click();
  await expect(page.getByText("Accepted · demo")).toBeVisible();
});

test("signed-in learner can open the account request form on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 850 });
  await page.route("**/api/auth/get-session*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      session: { id: "session-demo", userId: "user-demo" },
      user: { id: "user-demo", name: "Demo Learner", email: "learner@example.test", activeRole: "learner" },
    }),
  }));
  await page.route("**/api/account/requests", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 201, json: { status: "eligible", requestId: "request-demo" } });
      return;
    }
    await route.fulfill({ status: 200, json: { requests: [] } });
  });

  await page.goto("/prototype");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "My requests" }).click();
  await page.getByRole("button", { name: "Send request" }).click();
  const dateInput = page.getByLabel("When is it due?");
  const calendarButton = page.getByLabel("Open date picker");
  await expect(calendarButton).toBeVisible();
  await expect(dateInput).toBeVisible();
  await calendarButton.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dateInput).toBeFocused();
  await expect(page.getByRole("button", { name: "Send request" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
