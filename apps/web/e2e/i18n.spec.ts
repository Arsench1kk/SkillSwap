import { expect, test } from "@playwright/test";

const cookieName = "skillswap-locale";

async function localeCookie(
  context: import("@playwright/test").BrowserContext,
) {
  return (await context.cookies()).find((c) => c.name === cookieName)?.value;
}

test("the switcher saves a cookie the server can read", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("group", { name: "Language" })
    .getByRole("button", { name: "RU" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect.poll(() => localeCookie(context)).toBe("ru");

  await page.goto("/privacy");
  await expect(page.getByRole("main")).toHaveAttribute("lang", "ru");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the switcher form saves the choice and returns to the page", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page
      .getByRole("group", { name: "Language" })
      .getByRole("button", { name: "KK" })
      .click();
    await expect(page).toHaveURL(/\/$/);
    expect(await localeCookie(context)).toBe("kk");

    // Reading pages stay readable without JavaScript (pre-rendered English).
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test("the language endpoint refuses external redirects", async ({
  request,
}) => {
  const response = await request.post("/api/locale", {
    form: { locale: "ru", next: "//evil.example/path" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(new URL(response.headers().location).host).not.toBe("evil.example");
});
