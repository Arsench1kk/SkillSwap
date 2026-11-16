import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";

/**
 * Shared state builders for E2E specs that test one state of a screen.
 * They insert rows directly, so they must NOT be used to prove the release
 * journey (see e2e/release/); use them for isolated states and regressions.
 * All rows are synthetic and removed by `npm run db:test:reset`.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function shortId(prefix: string) {
  return `${prefix}-${randomBytes(5).toString("hex")}`;
}

export async function createLinkToken(
  pool: Pool,
  input: {
    purpose: string;
    subjectType: string;
    subjectId: string;
    expiresAt?: Date;
  },
) {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO link_tokens (token_hash, purpose, subject_type, subject_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      createHash("sha256").update(token).digest(),
      input.purpose,
      input.subjectType,
      input.subjectId,
      input.expiresAt ?? new Date(Date.now() + 2 * DAY),
    ],
  );
  return token;
}

export async function createOperator(pool: Pool) {
  const operatorId = shortId("O");
  await pool.query(
    `INSERT INTO participants (participant_id, role, consent_given_at)
     VALUES ($1, 'operator', now())`,
    [operatorId],
  );
  return operatorId;
}

/** A mentor whose skill evidence an operator has verified. */
export async function createVerifiedMentor(
  pool: Pool,
  input: { operatorId?: string; topic?: string } = {},
) {
  const operatorId = input.operatorId ?? (await createOperator(pool));
  const mentorId = shortId("M");
  await pool.query(
    `INSERT INTO participants (participant_id, role, consent_given_at, year_of_study, status)
     VALUES ($1, 'mentor', now(), 3, 'active')`,
    [mentorId],
  );
  await pool.query(
    `INSERT INTO participant_contacts (participant_id, contact_type, value)
     VALUES ($1, 'telegram', $2)`,
    [mentorId, `@${mentorId.toLowerCase().replace("-", "_")}`],
  );
  await pool.query(
    `INSERT INTO mentor_profiles (participant_id, display_name, experience_statement)
     VALUES ($1, 'Mentor Test', 'Has solved this kind of task.')`,
    [mentorId],
  );
  await pool.query(
    `INSERT INTO skill_evidence
       (mentor_participant_id, category, topic, proof_type, proof_reference,
        verification_state, verified_at, verified_by)
     VALUES ($1, 'STEM', $2, 'project', 'synthetic-reference', 'verified', now(), $3)`,
    [mentorId, input.topic ?? "Spreadsheet charts", operatorId],
  );
  return { mentorId, operatorId };
}

export async function createLearner(pool: Pool) {
  const learnerId = shortId("L");
  await pool.query(
    `INSERT INTO participants (participant_id, role, consent_given_at, year_of_study, status)
     VALUES ($1, 'learner', now(), 2, 'active')`,
    [learnerId],
  );
  await pool.query(
    `INSERT INTO participant_contacts (participant_id, contact_type, value)
     VALUES ($1, 'telegram', $2)`,
    [learnerId, `@${learnerId.toLowerCase().replace("-", "_")}`],
  );
  return learnerId;
}

/**
 * One confirmed meeting: request → confirmed brief → accepted match →
 * scheduled session, starting `startsInHours` from now.
 */
export async function createScheduledMeeting(
  pool: Pool,
  input: {
    learnerId: string;
    mentorId: string;
    startsInHours: number;
    task?: string;
  },
) {
  const requestId = randomUUID();
  const briefId = randomUUID();
  const matchId = randomUUID();
  const sessionId = randomUUID();
  const startsAt = new Date(Date.now() + input.startsInHours * HOUR);
  const endsAt = new Date(startsAt.getTime() + 45 * 60_000);
  const window = {
    startUtc: startsAt.toISOString(),
    endUtc: new Date(startsAt.getTime() + HOUR).toISOString(),
  };
  const second = {
    startUtc: new Date(startsAt.getTime() + DAY).toISOString(),
    endUtc: new Date(startsAt.getTime() + DAY + HOUR).toISOString(),
  };
  await pool.query(
    `INSERT INTO learner_requests
       (id, participant_id, task_category, task_description, tried_already,
        deadline_at, preferred_windows, give_back, status)
     VALUES ($1, $2, 'STEM', $3, 'Checked the formula.', $4, $5::jsonb, '', 'session_scheduled')`,
    [
      requestId,
      input.learnerId,
      input.task ?? `Synthetic task ${requestId.slice(0, 8)}`,
      new Date(Date.now() + 5 * DAY),
      JSON.stringify([window, second]),
    ],
  );
  await pool.query(
    `INSERT INTO mentor_briefs
       (id, request_id, mentor_participant_id, template_version, sent_at, answer_by, status)
     VALUES ($1, $2, $3, 'fixture-v1', now(), $4, 'confirmed')`,
    [briefId, requestId, input.mentorId, new Date(Date.now() + 2 * DAY)],
  );
  await pool.query(
    `INSERT INTO matches
       (id, request_id, mentor_participant_id, human_decision, proposed_slot_at,
        mentor_accepted_at, learner_accepted_at, status)
     VALUES ($1, $2, $3, 'accepted', $4, now(), now(), 'accepted')`,
    [matchId, requestId, input.mentorId, startsAt],
  );
  await pool.query(
    `INSERT INTO sessions
       (id, match_id, starts_at, ends_at, template_version, completion_state, meet_url)
     VALUES ($1, $2, $3, $4, 'fixture-v1', 'scheduled', 'https://meet.google.com/fixture-room')`,
    [sessionId, matchId, startsAt, endsAt],
  );
  return { requestId, briefId, matchId, sessionId, startsAt };
}

/**
 * Regression state for audit A04: one learner with several confirmed meetings
 * with different mentors. A session link must open the meeting it was issued
 * for, not whichever row a query returns first.
 */
export async function createLearnerWithMeetings(pool: Pool, count = 2) {
  const learnerId = await createLearner(pool);
  const { operatorId } = await createVerifiedMentor(pool);
  const meetings = [];
  for (let index = 0; index < count; index += 1) {
    const { mentorId } = await createVerifiedMentor(pool, { operatorId });
    meetings.push(
      await createScheduledMeeting(pool, {
        learnerId,
        mentorId,
        startsInHours: 24 * (index + 1),
        task: `Meeting ${index + 1} task`,
      }),
    );
  }
  return { learnerId, operatorId, meetings };
}
