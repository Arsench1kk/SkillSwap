import { expect, test } from "@playwright/test";

test("design kit renders and exposes the component states at 360px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  const response = await page.goto("/dev/kit");

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Design kit" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send request" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submitting request" }),
  ).toBeDisabled();
  await expect(page.getByText("This link no longer works.")).toBeVisible();
  await expect(page.locator(".ss-competence")).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 360);

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Send request" }),
  ).toBeFocused();
  await expect(page.getByRole("button", { name: "Send request" })).toHaveCSS(
    "box-shadow",
    /29, 95, 209/,
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 1280);
});
