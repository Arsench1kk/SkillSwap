import { expect, test } from "@playwright/test";

for (const width of [360, 1440]) {
  test(`mentor skills stay readable and searchable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/prototype");
    await page
      .getByRole("button", { name: "Find a mentor", exact: true })
      .last()
      .click();
    const search = page.getByRole("textbox", {
      name: "Search a skill, topic, or tool",
    });
    await search.fill("figma");
    await expect(
      page.getByText("Can help with", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mira B." })).toBeVisible();
    await page.getByRole("button", { name: "View profile" }).click();
    await expect(
      page.getByText("Can help with", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ask this mentor" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
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
  await expect(page.getByText("Wants to learn", { exact: true })).toHaveCount(
    0,
  );
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

test("signed-in learner can submit an account request on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 850 });
  await page.route("**/api/auth/get-session*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: { id: "session-demo", userId: "user-demo" },
        user: {
          id: "user-demo",
          name: "Demo Learner",
          email: "learner@example.test",
          activeRole: "learner",
        },
      }),
    }),
  );
  await page.route("**/api/account/requests", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        json: { status: "eligible", requestId: "request-demo" },
      });
      return;
    }
    await route.fulfill({ status: 200, json: { requests: [] } });
  });

  await page.goto("/prototype");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("button", { name: "Find a mentor" })
    .click();
  await expect(
    page.getByText("No mentor profiles are available yet."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Describe your task" }).click();
  const dateInput = page.getByLabel("When is it due?");
  const calendarButton = page.getByLabel("Open date picker");
  await expect(calendarButton).toBeVisible();
  await expect(dateInput).toBeVisible();
  await calendarButton.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dateInput).toBeFocused();
  const validDate = await dateInput.getAttribute("min");
  if (!validDate) throw new Error("Missing request minimum date");
  await page
    .getByLabel("What exactly are you stuck on?")
    .fill("I cannot interpret my regression output.");
  await page
    .getByLabel("What have you already tried?")
    .fill("I checked the Excel output and course notes.");
  await dateInput.fill(validDate);
  await page.getByLabel("From 1").fill(`${validDate}T18:00`);
  await page.getByLabel("To 1").fill(`${validDate}T19:00`);
  await page.getByLabel("From 2").fill(`${validDate}T19:30`);
  await page.getByLabel("To 2").fill(`${validDate}T20:30`);
  await page.getByLabel("Telegram username").fill("learner_example");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(
    page.getByText(
      "Request sent to the team. Your preferred mentor has not been contacted yet.",
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});

test("a new learner sees only account identity and empty account sections", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 850 });
  await page.route("**/api/auth/get-session*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: { id: "session-new", userId: "user-new" },
        user: {
          id: "user-new",
          name: "New Learner",
          email: "new@example.test",
          activeRole: "learner",
        },
      }),
    }),
  );
  await page.route("**/api/account/requests", (route) =>
    route.fulfill({
      status: 200,
      json: { requests: [] },
    }),
  );

  await page.goto("/prototype");
  await expect(
    page.getByRole("heading", {
      name: "What would you like help with?",
    }),
  ).toBeVisible();
  await expect(page.getByText("Preview mode", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Arsen Abduhalyk", { exact: true })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("button", { name: "Find a mentor" })
    .click();
  await expect(
    page.getByText("No mentor profiles are available yet."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aigerim S." })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "My requests" }).click();
  await expect(
    page.getByRole("heading", { name: "No requests yet." }),
  ).toBeVisible();
  await expect(
    page.getByText("Build a pivot table that updates automatically"),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sessions" }).click();
  await expect(
    page.getByRole("heading", { name: "No sessions yet." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "My profile" }).click();
  await expect(
    page.getByRole("heading", { name: "New Learner" }),
  ).toBeVisible();
  await expect(page.getByText("new@example.test")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Your profile is just getting started.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Excel basics", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});

test("the prototype language switcher translates and persists after reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 850 });
  await page.goto("/prototype");

  await page.getByRole("button", { name: "RU", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "С какой задачей нужна помощь?",
    }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");

  await page.getByRole("button", { name: "KK", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Қай тапсырма бойынша көмек керек?",
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Қай тапсырма бойынша көмек керек?",
    }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});
