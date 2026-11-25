import { expect, test } from "@playwright/test";

test.describe("workspace request list at phone width", () => {
  test.use({ viewport: { width: 360, height: 850 } });

  test("preserves the demo list and request action", async ({ page }) => {
    await page.route("**/api/auth/get-session*", (route) =>
      route.fulfill({ json: null }),
    );
    await page.goto("/prototype");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { name: "My requests" }).click();

    await expect(page.getByRole("note")).toBeVisible();
    await expect(page.getByRole("article")).not.toHaveCount(0);
    await page
      .getByRole("button", { name: "Open request" })
      .first()
      .press("Enter");
    await expect(page.getByRole("status")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });

  test("shows loading, retries a failure and renders the account list", async ({
    page,
  }) => {
    await page.route("**/api/auth/get-session*", (route) =>
      route.fulfill({
        json: {
          session: { id: "test-session", userId: "test-user" },
          user: {
            id: "test-user",
            name: "Test learner",
            email: "test@example.test",
            activeRole: "learner",
          },
        },
      }),
    );

    let releaseFirstRequest!: () => void;
    const firstResponse = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve;
    });
    let shouldFail = true;
    await page.route("**/api/account/requests", async (route) => {
      if (shouldFail) {
        await firstResponse;
        await route.fulfill({ status: 503 });
        return;
      }
      await route.fulfill({
        json: {
          requests: [
            {
              id: "test-request",
              taskDescription: "Review a chart for my class",
              taskCategory: "STEM",
              status: "slot_proposed",
              deadlineAt: "2026-11-20T09:00:00Z",
              createdAt: "2026-11-14T09:00:00Z",
            },
          ],
        },
      });
    });

    try {
      await page.goto("/prototype");
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.getByRole("button", { name: "My requests" }).click();
      await expect(page.getByText("Loading your requests…")).toBeVisible();
    } finally {
      releaseFirstRequest();
    }

    await expect(
      page.getByText("Your requests could not be loaded."),
    ).toBeVisible();
    shouldFail = false;
    await page.getByRole("button", { name: "Try again" }).press("Enter");
    await expect(
      page.getByRole("heading", { name: "Review a chart for my class" }),
    ).toBeVisible();
    await expect(
      page.getByText("Your requests could not be loaded."),
    ).toHaveCount(0);
    await expect(page.getByRole("note")).toHaveCount(0);
  });
});
