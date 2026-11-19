import { expect, test } from "@playwright/test";

test("mentor card preserves selection and navigation with the keyboard at 360px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.route("**/api/auth/get-session*", (route) =>
    route.fulfill({ json: null }),
  );
  await page.goto("/prototype");
  await page.getByRole("button", { name: "Find a mentor" }).last().click();
  await page
    .getByRole("button", { name: "Design", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "View profile" }).press("Enter");

  await expect(page.getByRole("heading", { name: "Mira B." })).toBeVisible();
  await expect(
    page.getByText("Portfolio work reviewed by the team"),
  ).toBeVisible();
  await expect(page.getByText("Figma", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Contact details are shared only after both people confirm.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("note")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);

  const ask = page.getByRole("button", { name: "Ask this mentor" });
  await ask.focus();
  await expect(ask).toBeFocused();
  await ask.press("Enter");
  await expect(
    page.getByRole("heading", { name: "What are you working on?" }),
  ).toBeVisible();
  await expect(page.getByText("Mira B.", { exact: true }).last()).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel", exact: true })
    .press("Enter");
  await expect(page.getByRole("heading", { name: "Mira B." })).toBeVisible();
  await page.getByRole("button", { name: "Back to results" }).press("Enter");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Mira B." })).toBeVisible();
});
