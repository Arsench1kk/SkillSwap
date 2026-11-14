import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";
import { messages } from "../../messages/en";

const connectionString = process.env.SKILLSWAP_D4_TEST_DATABASE_URL;
const pool = new Pool({ connectionString });

type FeedbackOptions = {
  outcome?: string;
  unblocked?: number;
  trust?: number;
  expired?: boolean;
  completionState?: "completed" | "scheduled";
};
async function fixture(options: FeedbackOptions = {}) {
  const learner = `L-${randomBytes(5).toString("hex")}`;
  const mentor = `M-${randomBytes(5).toString("hex")}`;
  const requestId = randomUUID(),
    matchId = randomUUID(),
    sessionId = randomUUID(),
    feedbackId = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO participants(participant_id,role,consent_given_at) VALUES ($1,'learner',now()),($2,'mentor',now())",
      [learner, mentor],
    );
    await client.query(
      "INSERT INTO mentor_profiles(participant_id) VALUES ($1)",
      [mentor],
    );
    await client.query(
      "INSERT INTO learner_requests(id,participant_id,task_category,task_description,tried_already,deadline_at,preferred_windows,status) VALUES ($1,$2,'STEM','Fix a chart','Checked formula',now()+interval '1 day','[]','session_scheduled')",
      [requestId, learner],
    );
    await client.query(
      "INSERT INTO matches(id,request_id,mentor_participant_id,human_decision,status,mentor_accepted_at,learner_accepted_at) VALUES ($1,$2,$3,'accepted','accepted',now(),now())",
      [matchId, requestId, mentor],
    );
    await client.query(
      "INSERT INTO sessions(id,match_id,template_version,starts_at,ends_at,completion_state) VALUES ($1,$2,'d4-browser-v1',now()-interval '4 hours',now()-($3::int * interval '1 minute'),$4)",
      [
        sessionId,
        matchId,
        options.expired ? 180 : 15,
        options.completionState ?? "completed",
      ],
    );
    await client.query(
      "INSERT INTO feedback(id,session_id,participant_id,unblocked,unblocked_missing_reason,one_line_outcome,outcome_missing_reason,trust,trust_missing_reason,safety_missing_reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'incomplete')",
      [
        feedbackId,
        sessionId,
        learner,
        options.unblocked ?? null,
        options.unblocked !== undefined ? null : "incomplete",
        options.outcome ?? null,
        options.outcome ? null : "incomplete",
        options.trust ?? null,
        options.trust ? null : "incomplete",
      ],
    );
    await client.query(
      "INSERT INTO link_tokens(token_hash,purpose,subject_type,subject_id,expires_at) VALUES ($1,'rating','feedback',$2,now()+interval '1 day')",
      [createHash("sha256").update(token).digest(), feedbackId],
    );
    await client.query("COMMIT");
    return { token, feedbackId, learner, mentor, sessionId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function row(id: string) {
  return (await pool.query("SELECT * FROM feedback WHERE id=$1", [id])).rows[0];
}

test.describe("D4 L5 at 360px", () => {
  test.skip(
    !connectionString,
    "Requires explicit dedicated D4 test DB and the app on the same DB",
  );
  test.use({ viewport: { width: 360, height: 780 } });

  test("completes remaining ratings without resending an existing read-only outcome", async ({
    page,
  }) => {
    const f = await fixture({ outcome: "I can repair the chart" });
    await page.goto(`/rate/${f.token}`);
    await expect(page.getByLabel(messages.ratingOutcome)).toHaveValue(
      "I can repair the chart",
    );
    await expect(page.getByLabel(messages.ratingOutcome)).toHaveAttribute(
      "readonly",
      "",
    );
    await page
      .getByRole("group", { name: messages.ratingUnblocked })
      .getByRole("radio", { name: "4", exact: true })
      .check();
    await page
      .getByRole("group", { name: messages.ratingTrust })
      .getByRole("radio", { name: "5", exact: true })
      .check();
    if (process.env.SKILLSWAP_D4_SCREENSHOT_PATH) {
      await page.screenshot({
        path: process.env.SKILLSWAP_D4_SCREENSHOT_PATH,
        fullPage: true,
      });
    }
    const request = page.waitForRequest(
      (r) => r.url().endsWith("/api/rating") && r.method() === "POST",
    );
    await page.getByRole("button", { name: messages.ratingSubmit }).click();
    const payload = (await request).postDataJSON();
    expect(payload).not.toHaveProperty("oneLineOutcome");
    await expect(page.getByText(messages.ratingThanks)).toBeVisible();
    expect(await row(f.feedbackId)).toMatchObject({
      one_line_outcome: "I can repair the chart",
      unblocked: 4,
      trust: 5,
    });
    expect(
      (
        await pool.query(
          "SELECT event_name FROM events WHERE participant_id=$1 ORDER BY event_name::text",
          [f.learner],
        )
      ).rows,
    ).toEqual([
      { event_name: "trust_submitted" },
      { event_name: "usefulness_submitted" },
    ]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });

  test("does not submit a saved read-only answer when nothing new is entered", async ({
    page,
  }) => {
    const f = await fixture({ outcome: "Already saved" });
    await page.goto(`/rate/${f.token}`);
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/api/rating") && r.method() === "POST")
        requests.push(r.url());
    });
    await page.getByRole("button", { name: messages.ratingSubmit }).click();
    await expect(page.locator(".rating-form").getByRole("alert")).toHaveText(
      messages.ratingAtLeastOne,
    );
    expect(requests).toHaveLength(0);
    expect((await row(f.feedbackId)).one_line_outcome).toBe("Already saved");
  });

  test("preserves new answers after a network failure and supports keyboard retry", async ({
    page,
  }) => {
    const f = await fixture();
    await page.goto(`/rate/${f.token}`);
    await page
      .getByRole("group", { name: messages.ratingTrust })
      .getByRole("radio", { name: "5", exact: true })
      .check();
    await page
      .getByLabel(messages.ratingOutcome)
      .fill("I can debug the formula");
    await page.route("**/api/rating", (route) => route.abort("failed"), {
      times: 1,
    });
    await page.getByRole("button", { name: messages.ratingSubmit }).click();
    await expect(page.locator(".rating-form").getByRole("alert")).toHaveText(
      messages.ratingError,
    );
    await expect(page.getByLabel(messages.ratingOutcome)).toHaveValue(
      "I can debug the formula",
    );
    await expect(
      page
        .getByRole("group", { name: messages.ratingTrust })
        .getByRole("radio", { name: "5", exact: true }),
    ).toBeChecked();
    await page.getByRole("button", { name: messages.ratingSubmit }).focus();
    await expect(
      page.getByRole("button", { name: messages.ratingSubmit }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText(messages.ratingPartialText)).toBeVisible();
    expect(await row(f.feedbackId)).toMatchObject({
      trust: 5,
      one_line_outcome: "I can debug the formula",
      unblocked: null,
    });
  });

  test("keeps early rating links closed", async ({ page }) => {
    const f = await fixture({ completionState: "scheduled" });
    const before = await row(f.feedbackId);
    await page.goto(`/rate/${f.token}`);
    await expect(page.getByText(messages.expiredLinkText)).toBeVisible();
    await expect(
      page.getByRole("button", { name: messages.ratingSubmit }),
    ).toHaveCount(0);
    expect(await row(f.feedbackId)).toEqual(before);
  });

  test("expired partial feedback is read-only and opening it has no DB effects", async ({
    page,
  }) => {
    const f = await fixture({
      expired: true,
      unblocked: 4,
      outcome: "Saved outcome",
    });
    const before = await row(f.feedbackId);
    await page.goto(`/rate/${f.token}`);
    await expect(
      page.getByText(messages.ratingPartialExpiredText),
    ).toBeVisible();
    await expect(page.getByText("Saved outcome")).toBeVisible();
    await expect(
      page.getByRole("button", { name: messages.ratingSubmit }),
    ).toHaveCount(0);
    expect(await row(f.feedbackId)).toEqual(before);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });
});

test.describe("D4 L4 existing actions at 360px", () => {
  test.skip(!connectionString, "Requires explicit dedicated D4 test DB");
  test.use({ viewport: { width: 360, height: 780 } });
  // pool belongs to this worker too; both describes share the module instance.
  for (const role of ["learner", "mentor"] as const) {
    test(`L4 ${role}: missing Meet, idempotent start and keyboard cancellation`, async ({
      page,
      request,
    }) => {
      const f = await fixture({ completionState: "scheduled" });
      const token = randomBytes(32).toString("base64url");
      await pool.query(
        "INSERT INTO link_tokens(token_hash,purpose,subject_type,subject_id,expires_at) VALUES ($1,'session','participant',$2,now()+interval '1 day')",
        [createHash("sha256").update(token).digest(), f[role]],
      );
      await page.goto(`/session/${token}`);
      await expect(
        page.getByRole("heading", { name: messages.sessionTitle }),
      ).toBeVisible();
      await expect(page.getByText(messages.sessionMeetMissing)).toBeVisible();
      await expect(
        page.getByRole("link", { name: messages.sessionOpenMeet }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: messages.sessionPlanTitle }),
      ).toBeVisible();
      const invoke = () =>
        request.post("/api/session/action", {
          data: { token, action: "start" },
        });
      expect((await invoke()).status()).toBe(200);
      expect((await invoke()).status()).toBe(200);
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM events WHERE participant_id=$1 AND event_name='session_started'",
            [f[role]],
          )
        ).rows[0].n,
      ).toBe(1);
      await page
        .getByRole("button", { name: messages.sessionCannotAttend })
        .focus();
      await expect(
        page.getByRole("button", { name: messages.sessionCannotAttend }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("status")).toHaveText(
        messages.sessionCancelled,
      );
      expect(
        (
          await pool.query(
            "SELECT completion_state FROM sessions WHERE id=$1",
            [f.sessionId],
          )
        ).rows[0].completion_state,
      ).toBe("cancelled");
      expect(
        (
          await pool.query(
            "SELECT event_name FROM events WHERE participant_id=$1 ORDER BY event_name::text",
            [f[role]],
          )
        ).rows,
      ).toEqual([
        { event_name: "session_cancelled" },
        { event_name: "session_started" },
      ]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(360);
    });
  }
});

test.describe("D4 L4 action errors at 360px", () => {
  test.skip(!connectionString, "Requires explicit dedicated D4 test DB");
  test.use({ viewport: { width: 360, height: 780 } });
  for (const failure of ["network", "server"] as const) {
    test(`L4 shows ${failure} start error while keeping external Meet available`, async ({
      page,
      context,
    }) => {
      const f = await fixture({ completionState: "scheduled" });
      await pool.query(
        "UPDATE sessions SET meet_url='https://meet.google.com/aaa-bbbb-ccc' WHERE id=$1",
        [f.sessionId],
      );
      const token = randomBytes(32).toString("base64url");
      await pool.query(
        "INSERT INTO link_tokens(token_hash,purpose,subject_type,subject_id,expires_at) VALUES ($1,'session','participant',$2,now()+interval '1 day')",
        [createHash("sha256").update(token).digest(), f.learner],
      );
      await context.route("https://meet.google.com/**", (route) =>
        route.fulfill({ status: 200, body: "Synthetic meeting fixture" }),
      );
      await page.goto(`/session/${token}`);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route(
        "**/api/session/action",
        (route) =>
          failure === "network"
            ? route.abort("failed")
            : route.fulfill({
                status: 503,
                json: { error: "action_unavailable" },
              }),
        { times: 1 },
      );
      const popup = context.waitForEvent("page");
      await page.getByRole("link", { name: messages.sessionOpenMeet }).click();
      const meeting = await popup;
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: messages.sessionActionError }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: messages.sessionOpenMeet }),
      ).toBeVisible();
      expect(
        (
          await pool.query(
            "SELECT completion_state FROM sessions WHERE id=$1",
            [f.sessionId],
          )
        ).rows[0].completion_state,
      ).toBe("scheduled");
      expect(errors).toEqual([]);
      await meeting.close();
    });
  }
  test("L4 failed cancellation does not claim success and can be retried", async ({
    page,
  }) => {
    const f = await fixture({ completionState: "scheduled" });
    const token = randomBytes(32).toString("base64url");
    await pool.query(
      "INSERT INTO link_tokens(token_hash,purpose,subject_type,subject_id,expires_at) VALUES ($1,'session','participant',$2,now()+interval '1 day')",
      [createHash("sha256").update(token).digest(), f.learner],
    );
    await page.goto(`/session/${token}`);
    await page.route(
      "**/api/session/action",
      (route) =>
        route.fulfill({ status: 503, json: { error: "action_unavailable" } }),
      { times: 1 },
    );
    await page
      .getByRole("button", { name: messages.sessionCannotAttend })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: messages.sessionActionError }),
    ).toBeVisible();
    await expect(page.getByText(messages.sessionCancelled)).toHaveCount(0);
    expect(
      (
        await pool.query("SELECT completion_state FROM sessions WHERE id=$1", [
          f.sessionId,
        ])
      ).rows[0].completion_state,
    ).toBe("scheduled");
    await page
      .getByRole("button", { name: messages.sessionCannotAttend })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      messages.sessionCancelled,
    );
    expect(
      (
        await pool.query("SELECT completion_state FROM sessions WHERE id=$1", [
          f.sessionId,
        ])
      ).rows[0].completion_state,
    ).toBe("cancelled");
  });
});

test.afterAll(async () => {
  await pool.end();
});
