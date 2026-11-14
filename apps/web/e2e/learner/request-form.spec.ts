import { expect, test, type Page } from "@playwright/test";

// L1 draft, error and retry behaviour. The API is stubbed here on purpose: the
// point is what the form does with each kind of failure, not the database.

const DAY = 86_400_000;
const date = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

async function fillForm(page: Page, contact = "@student_123") {
  await page
    .getByLabel("What exactly are you stuck on?")
    .fill("Chart is stale.");
  await page.getByLabel("What have you already tried?").fill("Refreshed data.");
  await page.getByLabel("When is it due?").fill(date(5));
  await page.getByLabel("From 1").fill(`${date(2)}T10:00`);
  await page.getByLabel("To 1").fill(`${date(2)}T11:00`);
  await page.getByLabel("From 2").fill(`${date(3)}T10:00`);
  await page.getByLabel("To 2").fill(`${date(3)}T11:00`);
  await page.locator("#request-contact").fill(contact);
  await page.getByRole("checkbox").check();
}

test.describe("L1 draft and failure handling", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test.beforeEach(async ({ page }) => {
    // The form writes its draft key once it has hydrated. Typing earlier would
    // be overwritten by the restore step, so wait for it, both before and after
    // clearing storage (a pending write from the first load must not leak in).
    const hydrated = () =>
      expect
        .poll(() =>
          page.evaluate(() =>
            sessionStorage.getItem("skillswap-request-draft-v1"),
          ),
        )
        .not.toBeNull();
    await page.goto("/request");
    await hydrated();
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await hydrated();
  });

  test("keeps the draft across a reload", async ({ page }) => {
    await fillForm(page);
    // Autosave runs after render; wait for it instead of racing the reload.
    await expect
      .poll(() =>
        page.evaluate(
          () => sessionStorage.getItem("skillswap-request-draft-v1") ?? "",
        ),
      )
      .toContain('"consent":true');
    await page.reload();
    await expect(page.getByLabel("What exactly are you stuck on?")).toHaveValue(
      "Chart is stale.",
    );
    await expect(page.locator("#request-contact")).toHaveValue("@student_123");
    await expect(page.getByLabel("To 2")).toHaveValue(`${date(3)}T11:00`);
  });

  test("does not tell the learner the network failed when the server rejected the content", async ({
    page,
  }) => {
    await page.route("**/api/request", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_time_window" }),
      }),
    );
    await fillForm(page);
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.locator(".ui-alert[role='alert']")).toHaveText(
      "Check the highlighted fields and try again.",
    );
    await expect(page.getByLabel("What exactly are you stuck on?")).toHaveValue(
      "Chart is stale.",
    );
  });

  test("keeps every typed value after a server failure and sends again on retry", async ({
    page,
  }) => {
    let calls = 0;
    await page.route("**/api/request", (route) => {
      calls += 1;
      if (calls === 1)
        return route.fulfill({
          status: 503,
          contentType: "text/html",
          body: "<html>Bad gateway</html>",
        });
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ status: "eligible", token: "retry-token" }),
      });
    });
    await fillForm(page);
    const send = page.getByRole("button", { name: "Send request" });
    await send.click();
    await expect(page.locator(".ui-alert[role='alert']")).toContainText(
      "Your draft is saved",
    );
    await expect(page.getByLabel("What have you already tried?")).toHaveValue(
      "Refreshed data.",
    );
    await expect(send).toBeEnabled();

    await send.click();
    await page.waitForURL("**/request/retry-token");
    expect(calls).toBe(2);
    // A sent request must not come back as a draft.
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("skillswap-request-draft-v1"),
      ),
    ).toBeNull();
  });

  test("blocks a malformed contact before any request is sent", async ({
    page,
  }) => {
    let calls = 0;
    await page.route("**/api/request", (route) => {
      calls += 1;
      return route.abort();
    });
    await fillForm(page, "+77771234567"); // a phone number while Telegram is selected
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(
      page.getByText("Add a Telegram username or phone number."),
    ).toBeVisible();
    expect(calls).toBe(0);
  });
});
