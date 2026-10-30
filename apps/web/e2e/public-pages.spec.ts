import { expect, test } from "@playwright/test";

async function fillMentorJoinForm(page: import("@playwright/test").Page) {
  await page.locator("#mentor-name").fill("Arsen A.");
  await page.locator("#mentor-topic").fill("Spreadsheet charts");
  await page
    .locator("#mentor-proof-reference")
    .fill("A sample spreadsheet project");
  await page.locator("#mentor-start-0").fill("2030-01-10T10:00");
  await page.locator("#mentor-end-0").fill("2030-01-10T11:00");
  await page.locator("#mentor-start-1").fill("2030-01-11T10:00");
  await page.locator("#mentor-end-1").fill("2030-01-11T11:00");
  await page.locator("#mentor-contact-value").fill("@mentor_arsen");
}

test.describe("public information pages", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("E0 explains the service and keeps the request-without-account path", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Get unstuck on the task in front of you.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/signup");
    await expect(
      page.getByRole("link", { name: /send a request/i }),
    ).toHaveAttribute("href", "/request");
    await expect(
      page.getByRole("link", { name: "Log in" }),
    ).toHaveAttribute("href", "/login");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });

  test("X3 covers collection, access, contact sharing and withdrawal", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: "Privacy and consent" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "What you share" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Withdrawing consent" }),
    ).toBeVisible();
    await expect(
      page.getByText(/needs team and qualified local review/),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });

  test("M1 exposes the requested skill, proof, availability and consent fields", async ({
    page,
  }) => {
    await page.goto("/mentor/join");
    await expect(
      page.getByRole("heading", { name: "Offer a skill" }),
    ).toBeVisible();
    await expect(page.getByLabel("Name or initials")).toBeVisible();
    await expect(page.getByLabel("Specific topic")).toBeVisible();
    await expect(page.getByLabel("Proof type")).toBeVisible();
    await expect(page.getByText("When could you meet?")).toBeVisible();
    await expect(page.getByRole("checkbox")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });

  test("M1 keeps entered details after a network failure", async ({ page }) => {
    await page.route("**/api/mentor/join", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await page.goto("/mentor/join");
    await fillMentorJoinForm(page);
    const consent = page.getByRole("checkbox");
    await consent.focus();
    await page.keyboard.press("Space");
    const submit = page.getByRole("button", { name: "Send mentor details" });
    await submit.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".form-error[role='alert']")).toBeVisible();
    await expect(page.locator("#mentor-name")).toHaveValue("Arsen A.");
    await expect(page.locator("#mentor-topic")).toHaveValue(
      "Spreadsheet charts",
    );
    await expect(consent).toBeChecked();
  });

  test("M1 can be submitted by keyboard and shows its confirmation", async ({
    page,
  }) => {
    await page.route("**/api/mentor/join", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      }),
    );
    await page.goto("/mentor/join");
    await fillMentorJoinForm(page);
    const consent = page.getByRole("checkbox");
    await consent.focus();
    await page.keyboard.press("Space");
    const submit = page.getByRole("button", { name: "Send mentor details" });
    await submit.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Details sent" }),
    ).toBeVisible();
  });
});
