import { expect, test } from "@playwright/test";

test("welcome explains SkillSwap and preserves the no-account request path", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Get unstuck on the task in front of you.",
    }),
  ).toBeVisible();
  await expect(page.getByText(/team reviews it/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "A clear next step, together" })).toBeVisible();
  await expect(page.getByText("An example of a two-way skill exchange")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /send a request/i }),
  ).toHaveAttribute("href", "/request");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("signup validates locally and shows verification state after Better Auth succeeds", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route("**/api/auth/sign-up/email", async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      name: "Arsen",
      email: "arsen@example.edu",
      activeRole: "learner",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "test-user" }, token: null }),
    });
  });
  await page.route("**/api/auth/send-verification-email", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      email: "arsen@example.edu",
      callbackURL: "/prototype",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });
  await page.goto("/signup");

  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your name to continue.")).toBeVisible();
  await expect(page.getByText("Enter your email address.")).toBeVisible();
  await expect(page.getByText("Enter your password.")).toBeVisible();

  await page.getByLabel("Your name").fill("Arsen");
  await page.getByLabel("Email address").fill("arsen@example.edu");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("sample-password");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await expect(
    page.getByText(/verify your email before signing in/i),
  ).toBeVisible();
  await expect(page.getByText("arsen@example.edu")).toBeVisible();
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(
    page.getByText("A new verification email has been sent."),
  ).toBeVisible();
});

test("mentor signup sends selected role; login stays a separate route", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route("**/api/auth/sign-up/email", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      activeRole: "mentor",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "test-mentor" }, token: null }),
    });
  });
  await page.goto("/signup?role=mentor");
  await expect(
    page.getByRole("button", { name: "Help another student" }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("Your name").fill("Mentor Test");
  await page.getByLabel("Email address").fill("mentor@example.edu");
  await page.getByLabel("Password", { exact: true }).fill("sample-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();

  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /create an account/i }),
  ).toBeVisible();
});

test("login preserves fields and shows a safe API error", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route("**/api/auth/sign-in/email", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Invalid credentials" }),
    });
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@example.edu");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form [role='alert']")).toHaveText(
    "We could not sign you in. Check your details and try again.",
  );
  await expect(page.getByLabel("Email address")).toHaveValue(
    "student@example.edu",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("wrong-password");
});

test("unverified login offers a resend action", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route("**/api/auth/sign-in/email", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        code: "EMAIL_NOT_VERIFIED",
        message: "Email not verified",
      }),
    });
  });
  await page.route("**/api/auth/send-verification-email", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@example.edu");
  await page.getByLabel("Password", { exact: true }).fill("sample-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/this account needs email verification/i)).toBeVisible();
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(
    page.getByText("A new verification email has been sent."),
  ).toBeVisible();
});

test("forgot-password response is generic and reset validates confirmation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route("**/api/auth/request-password-reset", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("student@example.edu");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByRole("heading", {
      name: "If the address is registered, a link is on its way",
    }),
  ).toBeVisible();

  await page.goto("/reset-password?token=rehearsal-token");
  await page.getByLabel("New password", { exact: true }).fill("a-new-password");
  await page.getByLabel("Confirm new password").fill("a-different-password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("These passwords do not match.")).toBeVisible();
});

test("workspace navigation collapses on desktop and opens as a dismissible mobile drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/prototype");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.locator("#workspace-navigation")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Expand sidebar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();

  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close navigation", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeHidden();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
