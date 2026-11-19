import { expect, test, type Page } from "@playwright/test";

function session(role: "learner" | "mentor" = "learner") {
  return {
    session: { id: "synthetic-session", userId: "synthetic-account" },
    user: {
      id: "synthetic-account",
      name: "Synthetic Student",
      email: "synthetic@example.test",
      activeRole: role,
    },
  };
}

async function prepare(page: Page) {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.route("**/api/account/requests", (route) =>
    route.fulfill({ json: { requests: [] } }),
  );
}

test("session loading and failure never open demo; retry restores the account", async ({
  page,
}) => {
  await prepare(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route("**/api/auth/get-session*", async (route) => {
    if (fail) {
      await gate;
      await route.fulfill({ status: 503, json: { message: "unavailable" } });
    } else {
      await route.fulfill({ json: session() });
    }
  });
  await page.goto("/prototype");
  await expect(page.getByRole("status")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("Arsen Abduhalyk", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Mentor", exact: true }),
  ).toHaveCount(0);
  release();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "We could not complete this request." }),
  ).toContainText("We could not complete this request.");
  await expect(page.getByText("Preview mode", { exact: false })).toHaveCount(0);
  fail = false;
  await page
    .getByRole("button", { name: "Try again", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "What would you like help with?" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "We could not complete this request." }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});

test("role switch waits for server confirmation, recovers from failure and blocks duplicate actions", async ({
  page,
}) => {
  await prepare(page);
  let role: "learner" | "mentor" = "learner";
  await page.route("**/api/auth/get-session*", (route) =>
    route.fulfill({ json: session(role) }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  await page.route("**/api/auth/update-user", async (route) => {
    attempts++;
    if (attempts === 1) {
      await gate;
      await route.fulfill({ status: 503, json: { message: "unavailable" } });
    } else {
      role = "mentor";
      await route.fulfill({ json: { status: true } });
    }
  });
  await page.goto("/prototype");
  const learner = page.getByRole("button", { name: "Learner", exact: true });
  const mentor = page.getByRole("button", { name: "Mentor", exact: true });
  await mentor.click();
  await expect(mentor).toBeDisabled();
  await expect(learner).toBeDisabled();
  await expect(learner).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", {
      name: "A focused request, when you have time.",
    }),
  ).toHaveCount(0);
  await mentor.press("Enter");
  expect(attempts).toBe(1);
  release();
  await expect(page.getByRole("status")).toContainText(
    "We could not save your active role.",
  );
  await expect(learner).toHaveAttribute("aria-pressed", "true");
  await mentor.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "A focused request, when you have time.",
    }),
  ).toBeVisible();
  await expect(mentor).toHaveAttribute("aria-pressed", "true");
  expect(attempts).toBe(2);
});

test("failed logout keeps the workspace available and permits a successful retry", async ({
  page,
}) => {
  await prepare(page);
  let signedOut = false;
  await page.route("**/api/auth/get-session*", (route) =>
    route.fulfill({ json: signedOut ? null : session() }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  await page.route("**/api/auth/sign-out", async (route) => {
    attempts++;
    if (attempts === 1) {
      await gate;
      await route.fulfill({ status: 503, json: { message: "unavailable" } });
    } else {
      signedOut = true;
      await route.fulfill({ json: { success: true } });
    }
  });
  await page.goto("/prototype");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("button", { name: "Settings" })
    .click();
  const logout = page.getByRole("button", { name: /^Sign out/ });
  await logout.click();
  await expect(logout).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Mentor", exact: true }),
  ).toBeDisabled();
  release();
  await expect(page.getByRole("status")).toContainText(
    "We could not sign you out.",
  );
  await expect(page).toHaveURL(/\/prototype$/);
  await expect(logout).toBeEnabled();
  await logout.press("Enter");
  await expect(page).toHaveURL(/\/$/);
  expect(attempts).toBe(2);
});
