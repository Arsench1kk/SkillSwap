import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type Page } from "@playwright/test";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://skillswap:skillswap@127.0.0.1:5433/skillswap";
const pool = new Pool({ connectionString });

async function createBriefFixture(
  options: {
    briefStatus?: string;
    requestStatus?: string;
    expiredLink?: boolean;
  } = {},
) {
  const mentorId = `M-${randomBytes(5).toString("hex")}`;
  const learnerId = `L-${randomBytes(5).toString("hex")}`;
  const requestId = randomUUID();
  const briefId = randomUUID();
  const matchId = randomUUID();
  const now = new Date();
  const deadline = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const answerBy = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const firstSlot = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const secondSlot = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  const preferredWindows = [firstSlot, secondSlot].map((slot) => ({
    startUtc: slot.toISOString(),
    endUtc: new Date(slot.getTime() + 60 * 60 * 1000).toISOString(),
  }));
  const status = options.briefStatus ?? "invited";
  const matchStatus = status === "confirmed" ? "accepted" : "proposed";
  const token = randomBytes(32).toString("base64url");

  await pool.query(
    `INSERT INTO participants (participant_id, role, consent_given_at, status)
     VALUES ($1, 'mentor', $3, 'active'), ($2, 'learner', $3, 'active')`,
    [mentorId, learnerId, now],
  );
  await pool.query("INSERT INTO mentor_profiles (participant_id) VALUES ($1)", [
    mentorId,
  ]);
  await pool.query(
    `INSERT INTO learner_requests
      (id, participant_id, task_category, task_description, tried_already,
       deadline_at, preferred_windows, give_back, status)
     VALUES ($1, $2, 'STEM', $3, $4, $5, $6::jsonb, $7, $8)`,
    [
      requestId,
      learnerId,
      "Fix a chart that does not update when the source data changes.",
      "Checked the formula and refreshed the file.",
      deadline,
      JSON.stringify(preferredWindows),
      "Can explain basic video editing.",
      options.requestStatus ?? "matched",
    ],
  );
  await pool.query(
    `INSERT INTO mentor_briefs
      (id, request_id, mentor_participant_id, template_version, sent_at, answer_by, status)
     VALUES ($1, $2, $3, 'm2-test-v1', $4, $5, $6)`,
    [briefId, requestId, mentorId, now, answerBy, status],
  );
  await pool.query(
    `INSERT INTO matches
      (id, request_id, mentor_participant_id, human_decision, proposed_slot_at, mentor_accepted_at, status)
     VALUES ($1, $2, $3, 'pending', $4, $5, $6)`,
    [
      matchId,
      requestId,
      mentorId,
      status === "slot_proposed" ? firstSlot : null,
      status === "slot_proposed" ? now : null,
      matchStatus,
    ],
  );
  await pool.query(
    `INSERT INTO link_tokens (token_hash, purpose, subject_type, subject_id, expires_at)
     VALUES ($1, 'mentor_brief', 'mentor_brief', $2, $3)`,
    [
      createHash("sha256").update(token).digest(),
      briefId,
      options.expiredLink ? new Date(now.getTime() - 1000) : answerBy,
    ],
  );
  if (status === "slot_proposed") {
    await pool.query(
      `INSERT INTO events (event_id, participant_id, role, event_name, data_origin, template_version)
       VALUES ($1, $2, 'mentor', 'slot_proposed', 'rehearsal', 'm2-test-v1')`,
      [randomUUID(), mentorId],
    );
  }
  const suggestedLocal = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(secondSlot)
    .replace(" ", "T");
  return { token, mentorId, briefId, firstSlot, secondSlot, suggestedLocal };
}

async function openAtPhone(page: Page, token: string) {
  const ipBytes = createHash("sha256").update(token).digest();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `198.18.${ipBytes[0]}.${ipBytes[1]}`,
  });
  await page.setViewportSize({ width: 360, height: 820 });
  const response = await page.goto(`/brief/${token}`);
  expect(response?.ok()).toBe(true);
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 360);
}

test.afterAll(async () => {
  await pool.end();
});

test("unanswered brief can be proposed using keyboard only", async ({
  page,
}) => {
  const fixture = await createBriefFixture();
  await openAtPhone(page, fixture.token);

  await expect(
    page.getByRole("heading", { name: "A student needs help with:" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Fix a chart that does not update when the source data changes.",
    ),
  ).toBeVisible();
  await expect(page.getByText("45 minutes, one session")).toBeVisible();
  await expect(
    page.getByText(
      "If you cannot make the session, let us know as early as you can.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Please answer by")).toBeVisible();

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio").first()).toBeFocused();
  await page.keyboard.press("Space");
  const proposeButton = page.getByRole("button", { name: "Propose a time" });
  for (let index = 0; index < 8; index += 1) {
    if (
      await proposeButton.evaluate(
        (button) => button === document.activeElement,
      )
    )
      break;
    await page.keyboard.press("Tab");
  }
  await expect(proposeButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(
      "The learner has your proposed time. You can change it until they confirm.",
    ),
  ).toBeVisible();

  const events = await pool.query(
    `SELECT event_name, template_version FROM events
     WHERE participant_id = $1 AND event_name IN ('mentor_accepted', 'slot_proposed')
     ORDER BY created_at DESC LIMIT 2`,
    [fixture.mentorId],
  );
  expect(events.rows.map((row) => row.event_name).sort()).toEqual([
    "mentor_accepted",
    "slot_proposed",
  ]);
  expect(
    events.rows.every((row) => row.template_version === "m2-test-v1"),
  ).toBe(true);
});

test("an answered brief shows its proposal and allows changing it", async ({
  page,
}) => {
  const fixture = await createBriefFixture({ briefStatus: "slot_proposed" });
  await openAtPhone(page, fixture.token);
  await expect(page.getByText("Your answer was sent").first()).toBeVisible();
  await expect(
    page.getByText("You can change it until they confirm."),
  ).toBeVisible();

  await page.getByRole("radio").nth(1).click();
  await page.getByRole("button", { name: "Change proposed time" }).click();
  await expect
    .poll(async () => {
      const proposalEvents = await pool.query(
        "SELECT event_id FROM events WHERE participant_id = $1 AND event_name = 'slot_proposed'",
        [fixture.mentorId],
      );
      return proposalEvents.rows.length;
    })
    .toBe(2);
  await page.reload();
  await expect(page.getByRole("radio").first()).toBeVisible();
  await expect(page.locator(".brief-current-slot")).toContainText(
    "Available time:",
  );
  await expect(page.locator('input[name="windowIndex"]:checked')).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Change proposed time" }),
  ).toBeVisible();
});

test("a confirmed proposal is read-only", async ({ page }) => {
  const fixture = await createBriefFixture({ briefStatus: "confirmed" });
  await openAtPhone(page, fixture.token);
  await expect(
    page.getByText(
      "The learner confirmed this time. Your answer can no longer be changed here.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Propose a time" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Change proposed time" }),
  ).toHaveCount(0);
});

test("a declined brief shows the closed reason response", async ({ page }) => {
  const fixture = await createBriefFixture();
  await openAtPhone(page, fixture.token);
  await page.getByRole("button", { name: "I can not help with this" }).click();
  await page.getByRole("radio", { name: "Not my skill" }).check();
  await page.getByRole("button", { name: "Send response" }).click();
  await expect(
    page.getByText("You declined. Changed your mind?"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Propose a time" }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Propose a time" }).click();
  await expect(
    page.getByText("You can change it until they confirm."),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your answer was sent" }),
  ).toBeVisible();
  const recovery = await pool.query(
    `SELECT from_state, to_state FROM state_transitions
     WHERE subject_id = $1 ORDER BY transitioned_at DESC LIMIT 1`,
    [fixture.briefId],
  );
  expect(recovery.rows[0]).toMatchObject({
    from_state: "declined",
    to_state: "slot_proposed",
  });
  const declined = await pool.query(
    `SELECT reason_code, template_version FROM events
     WHERE participant_id = $1 AND event_name = 'decline_reason' ORDER BY created_at DESC LIMIT 1`,
    [fixture.mentorId],
  );
  expect(declined.rows[0]).toMatchObject({
    reason_code: "not_my_skill",
    template_version: "m2-test-v1",
  });
  const renewedProposalEvents = await pool.query(
    `SELECT event_name FROM events
     WHERE participant_id = $1 AND event_name IN ('mentor_accepted', 'slot_proposed')`,
    [fixture.mentorId],
  );
  expect(
    renewedProposalEvents.rows.map((row) => row.event_name).sort(),
  ).toEqual(["mentor_accepted", "slot_proposed"]);
});

test("cancelled and expired links show their dedicated states", async ({
  page,
}) => {
  const cancelled = await createBriefFixture({ requestStatus: "cancelled" });
  await openAtPhone(page, cancelled.token);
  await expect(
    page.getByRole("heading", { name: "The learner cancelled this request" }),
  ).toBeVisible();
  await expect(
    page.getByText("Thank you for taking the time to read the brief."),
  ).toBeVisible();

  const expired = await createBriefFixture({ expiredLink: true });
  await openAtPhone(page, expired.token);
  await expect(
    page.getByRole("heading", { name: "This link no longer works." }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Contact the team through the channel where you received the link.",
    ),
  ).toBeVisible();
});

test("network failure keeps the selected answer and offers a retry", async ({
  page,
}) => {
  const fixture = await createBriefFixture();
  await openAtPhone(page, fixture.token);
  await page.route("**/api/brief/action", (route) => route.abort());
  await page.getByRole("radio", { name: "Suggest another time" }).check();
  const suggestedAt = page.getByLabel("Your suggested time (Almaty time)");
  await suggestedAt.fill(fixture.suggestedLocal);
  await page.getByRole("button", { name: "Propose a time" }).click();
  await expect(
    page.locator(".brief-action-form .brief-error").first(),
  ).toHaveText(
    "We could not send your answer. Check your connection and try again.",
  );
  await expect(suggestedAt).toHaveValue(fixture.suggestedLocal);
});

test("the 11th action attempt in 15 minutes is rejected by token hash", async ({
  request,
}) => {
  const token = randomBytes(32).toString("base64url");
  const expectedHash = createHash("sha256")
    .update(`mentor-brief-action:${token}`)
    .digest("hex");
  let lastStatus = 0;
  const ipBytes = createHash("sha256").update(token).digest();
  const ip = `198.18.${ipBytes.readUInt8(0)}.${ipBytes.readUInt8(1)}`;
  for (let attempt = 0; attempt < 11; attempt += 1) {
    const response = await request.post("/api/brief/action", {
      data: { token, action: "decline", reasonCode: "other" },
      headers: { "x-forwarded-for": ip },
    });
    lastStatus = response.status();
  }
  expect(lastStatus).toBe(429);
  const counter = await pool.query(
    "SELECT key_hash, count FROM rate_limit_counters WHERE key_hash = $1",
    [expectedHash],
  );
  expect(counter.rows).toHaveLength(1);
  expect(counter.rows[0].count).toBe(10);
  expect(counter.rows[0].key_hash).not.toContain(token);
  await pool.query("DELETE FROM rate_limit_counters WHERE key_hash = $1", [
    expectedHash,
  ]);
});

test("the brief page limits token probing by IP", async ({ request }) => {
  const ip = "198.51.100.42";
  const expectedHash = createHash("sha256")
    .update(`mentor-brief-page-ip:${ip}`)
    .digest("hex");
  let finalBody = "";
  for (let attempt = 0; attempt < 31; attempt += 1) {
    const response = await request.get("/brief/invalid", {
      headers: { "x-forwarded-for": ip },
    });
    finalBody = await response.text();
  }
  expect(finalBody).toContain(
    "Too many attempts. Please try again in a few minutes.",
  );
  const counter = await pool.query(
    "SELECT key_hash, count FROM rate_limit_counters WHERE key_hash = $1",
    [expectedHash],
  );
  expect(counter.rows[0]).toMatchObject({ key_hash: expectedHash, count: 30 });
  await pool.query("DELETE FROM rate_limit_counters WHERE key_hash = $1", [
    expectedHash,
  ]);
});

test("a mentor may withdraw a proposal before learner confirmation", async ({
  page,
}) => {
  const fixture = await createBriefFixture({ briefStatus: "slot_proposed" });
  await openAtPhone(page, fixture.token);
  await page.getByRole("button", { name: "Withdraw proposed time" }).click();
  await expect(
    page.getByText("You withdrew your proposed time."),
  ).toBeVisible();
  const event = await pool.query(
    "SELECT event_name, template_version FROM events WHERE participant_id = $1 AND event_name = 'mentor_withdrew' ORDER BY created_at DESC LIMIT 1",
    [fixture.mentorId],
  );
  expect(event.rows[0]).toMatchObject({
    event_name: "mentor_withdrew",
    template_version: "m2-test-v1",
  });
});
