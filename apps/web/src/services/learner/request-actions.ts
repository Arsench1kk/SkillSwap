import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { learnerRequests, matches, mentorBriefs } from "@/db/schema";
import { recordEvent } from "@/domain/events";
import {
  addCalendarDays,
  almatyDate,
  validDateOnly,
} from "@/domain/learner-request-submission-rules";
import {
  transitionLearnerRequest,
  transitionMentorBrief,
} from "@/domain/state-machines";
import { kazakhstanLocalTimeToUtc } from "@/domain/time";

/**
 * Learner-side actions on an existing request (L2/L3): cancel, update,
 * confirm and decline the proposed time.
 *
 * Every action re-reads the state it depends on INSIDE its transaction, under
 * row locks, and applies the change with a predicate on the state it expects.
 * A stale page or a concurrent mentor/operator action therefore produces a
 * "state_changed" result instead of overwriting newer data.
 *
 * Lock order for actions that touch a proposal (shared with the mentor
 * routes, which lock the brief first and then update the match):
 *   mentor_briefs row -> learner_requests row -> matches row
 * Other modules that lock these rows in one transaction should keep it.
 */

type Transaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]
>[0];
export type LearnerActionDatabase = NodePgDatabase<typeof schema> | Transaction;

type DataOrigin = (typeof schema.dataOrigin.enumValues)[number];

export type LearnerActionResult =
  { ok: true } | { ok: false; error: "state_changed" | "invalid_update" };

type ActionContext = {
  requestId: string;
  dataOrigin: DataOrigin;
  now?: Date;
};

// Thrown inside a transaction to roll everything back after a failed check.
class StateChanged extends Error {
  constructor() {
    super("state_changed");
  }
}

const stateChanged: LearnerActionResult = { ok: false, error: "state_changed" };

/**
 * Locks brief -> request -> latest match of a request and re-validates that
 * the learner is still looking at the proposal the operator and mentor
 * agreed on. Throws StateChanged when anything moved.
 */
async function lockAcceptedProposal(tx: Transaction, requestId: string) {
  // Unlocked read only to learn which rows to lock.
  const [candidate] = await tx
    .select({
      id: matches.id,
      mentorParticipantId: matches.mentorParticipantId,
    })
    .from(matches)
    .where(eq(matches.requestId, requestId))
    .orderBy(desc(matches.createdAt))
    .limit(1);
  if (!candidate?.mentorParticipantId) throw new StateChanged();

  const [candidateBrief] = await tx
    .select({ id: mentorBriefs.id })
    .from(mentorBriefs)
    .where(
      and(
        eq(mentorBriefs.requestId, requestId),
        eq(mentorBriefs.mentorParticipantId, candidate.mentorParticipantId),
      ),
    )
    .orderBy(desc(mentorBriefs.sentAt))
    .limit(1);
  if (!candidateBrief) throw new StateChanged();

  const [brief] = await tx
    .select({
      id: mentorBriefs.id,
      status: mentorBriefs.status,
      templateVersion: mentorBriefs.templateVersion,
    })
    .from(mentorBriefs)
    .where(eq(mentorBriefs.id, candidateBrief.id))
    .for("update")
    .limit(1);
  const [request] = await tx
    .select({
      status: learnerRequests.status,
      participantId: learnerRequests.participantId,
      taskCategory: learnerRequests.taskCategory,
    })
    .from(learnerRequests)
    .where(eq(learnerRequests.id, requestId))
    .for("update")
    .limit(1);
  const [match] = await tx
    .select()
    .from(matches)
    .where(eq(matches.id, candidate.id))
    .for("update")
    .limit(1);
  // Still the newest match? An operator may have created a newer one meanwhile.
  const [latest] = await tx
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.requestId, requestId))
    .orderBy(desc(matches.createdAt))
    .limit(1);

  if (
    !brief ||
    !request ||
    !match ||
    latest?.id !== match.id ||
    request.status !== "matched" ||
    brief.status !== "slot_proposed" ||
    match.status !== "proposed" ||
    match.humanDecision !== "accepted" ||
    !match.mentorAcceptedAt ||
    match.learnerAcceptedAt !== null
  ) {
    throw new StateChanged();
  }
  return { brief, request, match };
}

async function run(
  database: LearnerActionDatabase,
  work: (tx: Transaction) => Promise<void>,
): Promise<LearnerActionResult> {
  try {
    await database.transaction(work);
    return { ok: true };
  } catch (error) {
    if (error instanceof StateChanged) return stateChanged;
    throw error;
  }
}

/** L3 "Confirm this time". Exactly one concurrent call can succeed. */
export function confirmLearnerMatch(
  database: LearnerActionDatabase,
  { requestId, dataOrigin, now = new Date() }: ActionContext,
): Promise<LearnerActionResult> {
  return run(database, async (tx) => {
    const { brief, request, match } = await lockAcceptedProposal(tx, requestId);
    const actor = {
      type: "participant" as const,
      participantId: request.participantId,
    };

    const briefTransition = await transitionMentorBrief(
      tx,
      brief.id,
      "confirmed",
      {
        actor,
        source: "L3",
        reasonCode: "learner_confirmed_time",
        at: now,
      },
    );
    if (!briefTransition.ok) throw new StateChanged();
    const requestTransition = await transitionLearnerRequest(
      tx,
      requestId,
      "session_scheduled",
      {
        actor,
        source: "L3",
        reasonCode: "learner_confirmed_time",
        at: now,
      },
    );
    if (!requestTransition.ok) throw new StateChanged();

    const updated = await tx
      .update(matches)
      .set({ status: "accepted", learnerAcceptedAt: now })
      .where(and(eq(matches.id, match.id), eq(matches.status, "proposed")))
      .returning({ id: matches.id });
    if (updated.length !== 1) throw new StateChanged();

    await recordEvent(
      tx,
      {
        participantId: request.participantId,
        dataOrigin,
        templateVersion: brief.templateVersion,
      },
      { eventName: "match_accepted" },
    );
  });
}

/** L3 "This time does not work": back to matching, match marked declined. */
export function declineLearnerMatch(
  database: LearnerActionDatabase,
  { requestId, dataOrigin, now = new Date() }: ActionContext,
): Promise<LearnerActionResult> {
  return run(database, async (tx) => {
    const { brief, request, match } = await lockAcceptedProposal(tx, requestId);

    const transition = await transitionLearnerRequest(
      tx,
      requestId,
      "matching",
      {
        actor: { type: "participant", participantId: request.participantId },
        source: "L3",
        reasonCode: "learner_declined_time",
        at: now,
      },
    );
    if (!transition.ok) throw new StateChanged();

    const updated = await tx
      .update(matches)
      .set({ status: "declined", humanDecision: "rejected" })
      .where(and(eq(matches.id, match.id), eq(matches.status, "proposed")))
      .returning({ id: matches.id });
    if (updated.length !== 1) throw new StateChanged();

    await recordEvent(
      tx,
      {
        participantId: request.participantId,
        dataOrigin,
        templateVersion: brief.templateVersion,
      },
      { eventName: "match_declined" },
    );
  });
}

/** L2 "Cancel request". The state machine decides which states may cancel. */
export function cancelLearnerRequest(
  database: LearnerActionDatabase,
  { requestId, dataOrigin, now = new Date() }: ActionContext,
): Promise<LearnerActionResult> {
  return run(database, async (tx) => {
    const [request] = await tx
      .select({ participantId: learnerRequests.participantId })
      .from(learnerRequests)
      .where(eq(learnerRequests.id, requestId))
      .limit(1);
    if (!request) throw new StateChanged();
    const transition = await transitionLearnerRequest(
      tx,
      requestId,
      "cancelled",
      {
        actor: { type: "participant", participantId: request.participantId },
        source: "L2",
        reasonCode: "learner_cancelled",
        at: now,
      },
    );
    if (!transition.ok) throw new StateChanged();
    await recordEvent(
      tx,
      { participantId: request.participantId, dataOrigin },
      { eventName: "request_cancelled" },
    );
  });
}

export type UpdateLearnerRequestInput = {
  /** YYYY-MM-DD, Kazakhstan calendar date. */
  deadline: string;
  windows: { start: string; end: string }[];
};

/**
 * L2 edit of deadline and time windows. Allowed while the request is waiting,
 * and after a mentor withdrew (then the request resumes matching).
 */
export function updateLearnerRequest(
  database: LearnerActionDatabase,
  input: UpdateLearnerRequestInput,
  { requestId, dataOrigin, now = new Date() }: ActionContext,
): Promise<LearnerActionResult> {
  const deadlineAt = validDateOnly(input.deadline)
    ? kazakhstanLocalTimeToUtc(`${input.deadline}T23:59`)
    : null;
  const today = almatyDate(now);
  const windows = input.windows.map(({ start, end }) => {
    const startUtc = kazakhstanLocalTimeToUtc(start);
    const endUtc = kazakhstanLocalTimeToUtc(end);
    return startUtc && endUtc && startUtc > now && endUtc > startUtc
      ? { startUtc, endUtc }
      : null;
  });
  const validWindows = windows.flatMap((window) => (window ? [window] : []));
  if (
    !deadlineAt ||
    deadlineAt < now ||
    input.deadline < today ||
    input.deadline > addCalendarDays(today, 14) ||
    input.windows.length < 2 ||
    input.windows.length > 3 ||
    validWindows.length !== windows.length
  ) {
    return Promise.resolve({ ok: false, error: "invalid_update" });
  }

  return run(database, async (tx) => {
    const [request] = await tx
      .select({
        status: learnerRequests.status,
        participantId: learnerRequests.participantId,
        taskCategory: learnerRequests.taskCategory,
      })
      .from(learnerRequests)
      .where(eq(learnerRequests.id, requestId))
      .for("update")
      .limit(1);
    if (!request) throw new StateChanged();

    let resumingAfterWithdrawal = false;
    if (request.status === "matched") {
      const [latestMatch] = await tx
        .select({ status: matches.status })
        .from(matches)
        .where(eq(matches.requestId, requestId))
        .orderBy(desc(matches.createdAt))
        .for("update")
        .limit(1);
      resumingAfterWithdrawal = latestMatch?.status === "withdrawn";
      if (!resumingAfterWithdrawal) throw new StateChanged();
    } else if (!["eligible", "matching"].includes(request.status)) {
      throw new StateChanged();
    }

    if (resumingAfterWithdrawal) {
      const transition = await transitionLearnerRequest(
        tx,
        requestId,
        "matching",
        {
          actor: { type: "participant", participantId: request.participantId },
          source: "L2",
          reasonCode: "learner_resumed_after_mentor_withdrawal",
          at: now,
        },
      );
      if (!transition.ok) throw new StateChanged();
    }
    await tx
      .update(learnerRequests)
      .set({
        deadlineAt,
        preferredWindows: validWindows.map((window) => ({
          startUtc: window.startUtc.toISOString(),
          endUtc: window.endUtc.toISOString(),
        })),
        updatedAt: now,
      })
      .where(eq(learnerRequests.id, requestId));
    await recordEvent(
      tx,
      { participantId: request.participantId, dataOrigin },
      { eventName: "request_updated", taskCategory: request.taskCategory },
    );
  });
}
