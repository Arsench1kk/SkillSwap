import { expect, test } from "@playwright/test";
import { createFixturePool } from "./support/database";
import { createLearnerWithMeetings, createLinkToken } from "./support/fixtures";

const pool = createFixturePool();

test.afterAll(async () => {
  await pool.end();
});

test("shared fixtures build a learner with two separate meetings", async () => {
  const { learnerId, meetings } = await createLearnerWithMeetings(pool, 2);
  expect(meetings).toHaveLength(2);
  const { rows } = await pool.query(
    `SELECT s.id, m.mentor_participant_id
       FROM sessions s
       JOIN matches m ON m.id = s.match_id
       JOIN learner_requests r ON r.id = m.request_id
      WHERE r.participant_id = $1`,
    [learnerId],
  );
  expect(rows.map((row) => row.id).sort()).toEqual(
    meetings.map((meeting) => meeting.sessionId).sort(),
  );
  expect(new Set(rows.map((row) => row.mentor_participant_id)).size).toBe(2);
  const token = await createLinkToken(pool, {
    purpose: "session",
    subjectType: "participant",
    subjectId: learnerId,
  });
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
});
