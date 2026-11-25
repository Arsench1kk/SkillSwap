import { expect, test } from "@playwright/test";

test.describe("mentor workspace invitations", () => {
  test.use({ viewport: { width: 360, height: 850 } });

  test("keeps demo answers across home and list navigation", async ({
    page,
  }) => {
    await page.route("**/api/auth/get-session*", (route) =>
      route.fulfill({ json: null }),
    );
    await page.goto("/prototype?role=mentor");
    await page.getByRole("button", { name: "I can help" }).press("Enter");
    await expect(
      page.getByText("Accepted · demo", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "See all", exact: true })
      .press("Enter");

    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(2);
    await expect(
      cards.first().getByText("Accepted · demo", { exact: true }),
    ).toBeVisible();
    await cards
      .first()
      .getByRole("button", { name: "Undo", exact: true })
      .press("Enter");
    await cards
      .first()
      .getByRole("button", { name: "Not this time" })
      .press("Enter");
    await expect(
      cards.first().getByText("Passed · demo", { exact: true }),
    ).toBeVisible();
    await cards
      .nth(1)
      .getByRole("button", { name: "I can help" })
      .press("Enter");
    await expect(
      cards.nth(1).getByText("Accepted · demo", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("button", { name: "Home", exact: true })
      .click();
    await expect(
      page.getByText("Passed · demo", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });

  test("shows empty invitations for an authenticated mentor", async ({
    page,
  }) => {
    await page.route("**/api/auth/get-session*", (route) =>
      route.fulfill({
        json: {
          session: { id: "test-mentor-session", userId: "test-mentor" },
          user: {
            id: "test-mentor",
            name: "Test mentor",
            email: "mentor@example.test",
            activeRole: "mentor",
          },
        },
      }),
    );
    await page.goto("/prototype");
    await expect(
      page.getByRole("heading", { name: "No invitations yet." }),
    ).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
    await page
      .getByRole("button", { name: "See all", exact: true })
      .press("Enter");
    await expect(
      page.getByRole("heading", { name: "No invitations yet." }),
    ).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "I can help" })).toHaveCount(
      0,
    );
  });
});
