import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";
import { expireUnansweredFeedback } from "../src/domain/expire-feedback";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://skillswap:skillswap@127.0.0.1:5433/skillswap",
});

type FixtureOptions = {
  requestStatus?:
    "eligible" | "matched" | "session_scheduled" | "no_match" | "cancelled";
  matchStatus?: "proposed" | "accepted";
  withSession?: boolean;
  withFeedback?: boolean;
  feedbackSubmitted?: boolean;
  feedbackPartial?: boolean;
  ratingExpired?: boolean;
};

async function createToken(
  purpose: string,
  subjectType: string,
  subjectId: string,
  expiresAt: Date,
) {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO link_tokens (token_hash, purpose, subject_type, subject_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      createHash("sha256").update(token).digest(),
      purpose,
      subjectType,
      subjectId,
      expiresAt,
    ],
  );
  return token;
}

async function createFixture(options: FixtureOptions = {}) {
  const learnerId = `L-${randomBytes(5).toString("hex")}`;
  const mentorId = `M-${randomBytes(5).toString("hex")}`;
  const operatorId = `O-${randomBytes(5).toString("hex")}`;
  const requestId = randomUUID();
  const matchId = randomUUID();
  const briefId = randomUUID();
  const now = new Date();
  const matchStatus = options.matchStatus ?? "proposed";
  const requestStatus =
    options.requestStatus ??
    (matchStatus === "accepted" ? "session_scheduled" : "matched");
  const proposedAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO participants (participant_id, role, consent_given_at, year_of_study)
     VALUES ($1, 'learner', $4, 2), ($2, 'mentor', $4, 3), ($3, 'operator', $4, NULL)`,
    [learnerId, mentorId, operatorId, now],
  );
  await pool.query(
    `INSERT INTO participant_contacts (participant_id, contact_type, value)
     VALUES ($1, 'telegram', '@learner_test'), ($2, 'telegram', '@mentor_test')`,
    [learnerId, mentorId],
  );
  await pool.query(
    `INSERT INTO mentor_profiles (participant_id, display_name, experience_statement)
     VALUES ($1, 'Mentor Test', 'Has solved this kind of task.')`,
    [mentorId],
  );
  await pool.query(
    `INSERT INTO skill_evidence
       (mentor_participant_id, category, topic, proof_type, proof_reference, verification_state, verified_at, verified_by)
     VALUES ($1, 'STEM', 'Spreadsheet charts', 'project', 'fake-reference', 'verified', $2, $3)`,
    [mentorId, now, operatorId],
  );
  await pool.query(
    `INSERT INTO learner_requests
       (id, participant_id, task_category, task_description, tried_already, deadline_at,
        preferred_windows, give_back, status, created_at)
     VALUES ($1, $2, 'STEM', 'Fix a chart that does not update.', 'Checked formula and refreshed.',
       $3, $4::jsonb, 'Can explain basic video editing.', $5, $6)`,
    [
      requestId,
      learnerId,
      new Date(now.getTime() + 5 * 86_400_000),
      JSON.stringify([
        {
          startUtc: proposedAt.toISOString(),
          endUtc: new Date(proposedAt.getTime() + 60 * 60 * 1000).toISOString(),
        },
        {
          startUtc: new Date(proposedAt.getTime() + 86_400_000).toISOString(),
          endUtc: new Date(proposedAt.getTime() + 90_000_000).toISOString(),
        },
      ]),
      requestStatus,
      now,
    ],
  );

  let briefToken: string | undefined;
  if (!["eligible", "no_match"].includes(requestStatus)) {
    await pool.query(
      `INSERT INTO mentor_briefs (id, request_id, mentor_participant_id, template_version, sent_at, answer_by, status)
       VALUES ($1, $2, $3, 'public-route-test-v1', $4, $5, $6)`,
      [
        briefId,
        requestId,
        mentorId,
        now,
        new Date(now.getTime() + 48 * 60 * 60 * 1000),
        matchStatus === "accepted" ? "confirmed" : "slot_proposed",
      ],
    );
    briefToken = await createToken(
      "mentor_brief",
      "mentor_brief",
      briefId,
      new Date(now.getTime() + 48 * 60 * 60 * 1000),
    );
    await pool.query(
      `INSERT INTO matches
       (id, request_id, mentor_participant_id, human_decision, proposed_slot_at,
        mentor_accepted_at, learner_accepted_at, status)
       VALUES ($1, $2, $3, 'accepted', $4, $5, $6, $7)`,
      [
        matchId,
        requestId,
        mentorId,
        proposedAt,
        now,
        matchStatus === "accepted" ? now : null,
        matchStatus,
      ],
    );
  }

  const requestToken = await createToken(
    "learner_status",
    "learner_request",
    requestId,
    new Date(now.getTime() + 30 * 86_400_000),
  );
  let sessionToken: string | undefined;
  let ratingToken: string | undefined;
  let feedbackIdForTest: string | undefined;
  if (options.withSession || options.withFeedback) {
    const sessionId = randomUUID();
    const endsAt = options.withFeedback
      ? new Date(
          now.getTime() - (options.ratingExpired ? 3 : 0.25) * 60 * 60 * 1000,
        )
      : new Date(proposedAt.getTime() + 45 * 60_000);
    const startsAt = new Date(endsAt.getTime() - 45 * 60_000);
    await pool.query(
      `INSERT INTO sessions (id, match_id, starts_at, ends_at, template_version, completion_state, meet_url)
       VALUES ($1, $2, $3, $4, 'session-test-v1', $5, 'https://meet.google.com/fake-room')`,
      [
        sessionId,
        matchId,
        startsAt,
        endsAt,
        options.withFeedback ? "completed" : "scheduled",
      ],
    );
    sessionToken = await createToken(
      "session",
      "participant",
      learnerId,
      new Date(now.getTime() + 2 * 86_400_000),
    );
    if (options.withFeedback) {
      const feedbackId = randomUUID();
      feedbackIdForTest = feedbackId;
      if (options.feedbackSubmitted) {
        await pool.query(
          `INSERT INTO feedback
           (id, session_id, participant_id, unblocked, one_line_outcome, trust, safety_missing_reason)
           VALUES ($1, $2, $3, 5, 'I can now repair the chart formula.', 4, 'incomplete')`,
          [feedbackId, sessionId, learnerId],
        );
      } else if (options.feedbackPartial) {
        await pool.query(
          `INSERT INTO feedback
           (id, session_id, participant_id, unblocked, unblocked_missing_reason,
            outcome_missing_reason, trust_missing_reason, safety_missing_reason)
           VALUES ($1, $2, $3, 4, NULL, 'incomplete', 'incomplete', 'incomplete')`,
          [feedbackId, sessionId, learnerId],
        );
      } else {
        await pool.query(
          `INSERT INTO feedback
           (id, session_id, participant_id, unblocked_missing_reason, outcome_missing_reason,
            trust_missing_reason, safety_missing_reason)
           VALUES ($1, $2, $3, 'incomplete', 'incomplete', 'incomplete', 'incomplete')`,
          [feedbackId, sessionId, learnerId],
        );
      }
      ratingToken = await createToken(
        "rating",
        "feedback",
        feedbackId,
        new Date(now.getTime() + 2 * 86_400_000),
      );
    }
  }
  return {
    requestToken,
    sessionToken,
    ratingToken,
    briefToken,
    feedbackId: feedbackIdForTest,
  };
}

test.afterAll(async () => {
  await pool.end();
});

test.describe("participant token routes at phone width", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("L2 waiting state renders without horizontal overflow", async ({
    page,
  }) => {
    const fixture = await createFixture({ requestStatus: "eligible" });
    await page.goto(`/request/${fixture.requestToken}`);
    await expect(
      page.getByRole("heading", { name: "Request received" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Report a problem" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });

  test("L2 no-match state explains that the request remains open", async ({
    page,
  }) => {
    const fixture = await createFixture({ requestStatus: "no_match" });
    await page.goto(`/request/${fixture.requestToken}`);
    await expect(
      page.getByRole("heading", { name: "We are still looking" }),
    ).toBeVisible();
    await expect(
      page.getByText("You can leave this request open while we keep looking."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel request" }),
    ).toBeVisible();
  });

  test("L2 learner can cancel a waiting request", async ({ page }) => {
    const fixture = await createFixture({ requestStatus: "eligible" });
    await page.goto(`/request/${fixture.requestToken}`);
    const cancel = page.getByRole("button", { name: "Cancel request" });
    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/request/status"),
    );
    await cancel.focus();
    await page.keyboard.press("Enter");
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Request cancelled" }),
    ).toBeVisible();
  });

  test("M2 shows a clear state when the learner cancelled", async ({
    page,
  }) => {
    const fixture = await createFixture({ requestStatus: "cancelled" });
    await page.goto(`/brief/${fixture.briefToken}`);
    await expect(
      page.getByRole("heading", { name: "The learner cancelled this request" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Report a problem" }),
    ).toBeVisible();
  });

  test("L3 matched state shows the mentor and proposed time", async ({
    page,
  }) => {
    const fixture = await createFixture({
      requestStatus: "matched",
      matchStatus: "proposed",
    });
    await page.goto(`/request/${fixture.requestToken}`);
    await expect(
      page.getByRole("heading", { name: "We found someone" }),
    ).toBeVisible();
    await expect(page.getByText("Mentor Test")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirm this time" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });

  test("L3 decline returns to a distinct recovery state", async ({ page }) => {
    const fixture = await createFixture({
      requestStatus: "matched",
      matchStatus: "proposed",
    });
    await page.goto(`/request/${fixture.requestToken}`);
    const decline = page.getByRole("button", {
      name: "This time does not work",
    });
    await decline.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "That time did not work" }),
    ).toBeVisible();
  });

  test("L3 reveals participant contacts only after learner confirmation", async ({
    page,
  }) => {
    const fixture = await createFixture({
      requestStatus: "matched",
      matchStatus: "proposed",
    });
    await page.goto(`/request/${fixture.requestToken}`);
    await expect(page.getByText("@learner_test")).toHaveCount(0);
    const confirm = page.getByRole("button", { name: "Confirm this time" });
    await confirm.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Time confirmed" }),
    ).toBeVisible();
    await expect(page.getByText("@learner_test")).toBeVisible();
    await expect(page.getByText("@mentor_test")).toBeVisible();
  });

  test("M2 withdrawal is distinct on L2 and offers a valid update path", async ({
    page,
  }) => {
    const fixture = await createFixture({
      requestStatus: "matched",
      matchStatus: "proposed",
    });
    if (!fixture.briefToken) throw new Error("Expected a brief token fixture");
    const ipBytes = createHash("sha256")
      .update(fixture.briefToken)
      .digest();
    await page.setExtraHTTPHeaders({
      "x-forwarded-for": `198.18.${ipBytes[0]}.${ipBytes[1]}`,
    });
    await page.goto(`/brief/${fixture.briefToken}`);
    const withdraw = page.getByRole("button", {
      name: "Withdraw proposed time",
    });
    await withdraw.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("You withdrew your proposed time."),
    ).toBeVisible();
    await page.goto(`/request/${fixture.requestToken}`);
    await expect(
      page.getByRole("heading", { name: "The mentor can no longer meet" }),
    ).toBeVisible();
    await page.getByText("Update your deadline and available times").click();
    await expect(page.getByLabel("When is it due?")).toBeVisible();
  });

  test("L4 session plan and Meet action render", async ({ page }) => {
    const fixture = await createFixture({
      requestStatus: "session_scheduled",
      matchStatus: "accepted",
      withSession: true,
    });
    await page.goto(`/session/${fixture.sessionToken}`);
    await expect(
      page.getByRole("heading", { name: "A simple plan" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open Google Meet" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });

  test("L4 cancellation is not mistaken for a mentor withdrawal on L2", async ({
    page,
  }) => {
    const fixture = await createFixture({
      requestStatus: "session_scheduled",
      matchStatus: "accepted",
      withSession: true,
    });
    await page.goto(`/session/${fixture.sessionToken}`);
    const cancel = page.getByRole("button", { name: "I cannot make it" });
    await cancel.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("The team has been told you cannot make it."),
    ).toBeVisible();
    await page.goto(`/request/${fixture.requestToken}`);
    await expect(
      page.getByRole("heading", { name: "This session was cancelled" }),
    ).toBeVisible();
  });

  test("L5 rating form renders", async ({ page }) => {
    const fixture = await createFixture({
      requestStatus: "session_scheduled",
      matchStatus: "accepted",
      withFeedback: true,
    });
    await page.goto(`/rate/${fixture.ratingToken}`);
    await expect(
      page.getByRole("heading", { name: "How did the session go?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send feedback" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });

  test("L5 partial feedback resumes and saves only remaining answers", async ({
    page,
  }) => {
    const fixture = await createFixture({
      requestStatus: "session_scheduled",
      matchStatus: "accepted",
      withFeedback: true,
      feedbackPartial: true,
    });
    await page.goto(`/rate/${fixture.ratingToken}`);
    await expect(
      page.getByText("Your saved answers are shown below."),
    ).toBeVisible();
    const savedRating = page.locator('input[name="unblocked"][value="4"]');
    await expect(savedRating).toBeChecked();
    await expect(savedRating).toBeDisabled();
    const outcome = page.getByLabel(
      "In one line, what can you do now that you could not before?",
    );
    await outcome.fill("I can repair the chart formula.");
    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/rating"),
    );
    await page.getByRole("button", { name: "Send feedback" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    await expect(
      page.getByText("Your saved answers are shown below."),
    ).toBeVisible();
    const saved = await pool.query(
      `SELECT unblocked, one_line_outcome, trust, outcome_missing_reason, trust_missing_reason
       FROM feedback WHERE id = $1`,
      [fixture.feedbackId],
    );
    expect(saved.rows[0]).toMatchObject({
      unblocked: 4,
      one_line_outcome: "I can repair the chart formula.",
      trust: null,
      outcome_missing_reason: null,
      trust_missing_reason: "incomplete",
    });
  });

  test("L5 stores unanswered feedback as no_reply after the two-hour window", async ({
    page,
  }) => {
    const fixture = await createFixture({
      requestStatus: "session_scheduled",
      matchStatus: "accepted",
      withFeedback: true,
      ratingExpired: true,
    });
    await expireUnansweredFeedback(pool);
    await page.goto(`/rate/${fixture.ratingToken}`);
    await expect(
      page.getByRole("heading", { name: "This feedback window has ended" }),
    ).toBeVisible();
    const saved = await pool.query(
      `SELECT unblocked_missing_reason, outcome_missing_reason, trust_missing_reason
       FROM feedback WHERE id = $1`,
      [fixture.feedbackId],
    );
    expect(saved.rows[0]).toEqual({
      unblocked_missing_reason: "no_reply",
      outcome_missing_reason: "no_reply",
      trust_missing_reason: "no_reply",
    });
  });

  test("L5 preserves partial answers after the feedback window closes", async ({
    page,
  }) => {
    const fixture = await createFixture({
      requestStatus: "session_scheduled",
      matchStatus: "accepted",
      withFeedback: true,
      feedbackPartial: true,
      ratingExpired: true,
    });
    await expireUnansweredFeedback(pool);
    await page.goto(`/rate/${fixture.ratingToken}`);
    await expect(
      page.getByText("The feedback window closed. Your saved answers remain"),
    ).toBeVisible();
    await expect(page.getByText("4", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send feedback" }),
    ).toHaveCount(0);
    const saved = await pool.query(
      `SELECT unblocked, unblocked_missing_reason, outcome_missing_reason, trust_missing_reason
       FROM feedback WHERE id = $1`,
      [fixture.feedbackId],
    );
    expect(saved.rows[0]).toEqual({
      unblocked: 4,
      unblocked_missing_reason: null,
      outcome_missing_reason: "no_reply",
      trust_missing_reason: "no_reply",
    });
  });

  test("L5 rating form can be completed by keyboard and retains values on failure", async ({
    page,
  }) => {
    const fixture = await createFixture({
      requestStatus: "session_scheduled",
      matchStatus: "accepted",
      withFeedback: true,
    });
    await page.route("**/api/rating", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await page.goto(`/rate/${fixture.ratingToken}`);
    const unblocked = page.locator('input[name="unblocked"][value="5"]');
    await unblocked.check();
    const outcome = page.getByLabel(
      "In one line, what can you do now that you could not before?",
    );
    await outcome.fill("I can fix the chart formula.");
    const trust = page.locator('input[name="trust"][value="4"]');
    await trust.check();
    const submit = page.getByRole("button", { name: "Send feedback" });
    await submit.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".form-error[role='alert']")).toBeVisible();
    await expect(unblocked).toBeChecked();
    await expect(outcome).toHaveValue("I can fix the chart formula.");
    await expect(trust).toBeChecked();
  });

  test("L5 shows already-submitted feedback without a second form", async ({
    page,
  }) => {
    const fixture = await createFixture({
      requestStatus: "session_scheduled",
      matchStatus: "accepted",
      withFeedback: true,
      feedbackSubmitted: true,
      ratingExpired: true,
    });
    await page.goto(`/rate/${fixture.ratingToken}`);
    await expect(page.getByText("Thank you for sharing this.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send feedback" }),
    ).toHaveCount(0);
  });

  test("L5 expires after the two-hour feedback window", async ({ page }) => {
    const fixture = await createFixture({
      requestStatus: "session_scheduled",
      matchStatus: "accepted",
      withFeedback: true,
      ratingExpired: true,
    });
    await page.goto(`/rate/${fixture.ratingToken}`);
    await expect(
      page.getByRole("heading", { name: "This feedback window has ended" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send feedback" }),
    ).toHaveCount(0);
  });

  test("X1 invalid link explains what to do", async ({ page }) => {
    await page.goto("/session/not-a-valid-token");
    await expect(
      page.getByRole("heading", { name: "This link no longer works." }),
    ).toBeVisible();
    await expect(
      page.getByText(/Contact the team through the channel/),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });

  test("X2 report form is reachable from a private learner link", async ({
    page,
  }) => {
    const fixture = await createFixture({ requestStatus: "eligible" });
    await page.goto(`/report/${fixture.requestToken}`);
    await expect(
      page.getByRole("heading", { name: "Report a problem" }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "What is this about?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send report" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });

  test("X2 submits a safety report and confirms it", async ({ page }) => {
    const fixture = await createFixture({ requestStatus: "eligible" });
    const ipBytes = createHash("sha256")
      .update(fixture.requestToken)
      .digest();
    await page.setExtraHTTPHeaders({
      "x-forwarded-for": `198.18.${ipBytes[0]}.${ipBytes[1]}`,
    });
    await page.goto(`/report/${fixture.requestToken}`);
    const category = page.getByLabel("Safety concern");
    await category.check();
    await page
      .getByLabel("What happened? (optional)")
      .fill("The agreed meeting time changed without notice.");
    const submit = page.getByRole("button", { name: "Send report" });
    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/report"),
    );
    await submit.click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    await expect(
      page.getByText("Your report was sent to the team."),
    ).toBeVisible();
  });
});
