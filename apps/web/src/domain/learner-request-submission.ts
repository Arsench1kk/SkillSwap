import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { db } from "@/db/client";
import {
  accountParticipants,
  learnerRequests,
  participantContacts,
  participants,
} from "@/db/schema";
import { createParticipant } from "@/domain/participants";
import { recordEvent } from "@/domain/events";
import { createPrivateLink } from "@/domain/private-links";
import { transitionLearnerRequest } from "@/domain/state-machines";
import { kazakhstanLocalTimeToUtc } from "@/domain/time";
import { z } from "zod";
import {
  addCalendarDays,
  almatyDate,
  contactIsValid,
  type LearnerRequestInput,
  validDateOnly,
} from "@/domain/learner-request-submission-rules";

// The pure rules live in learner-request-submission-rules.ts so the browser
// form can use them. Re-exported here to keep existing imports working.
export {
  addCalendarDays,
  contactIsValid,
  learnerRequestInputSchema,
  validDateOnly,
  type LearnerRequestInput,
} from "@/domain/learner-request-submission-rules";


type Transaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]
>[0];

async function findOrCreateLearnerParticipant(
  transaction: Transaction,
  authUserId: string,
  now: Date,
) {
  const [linked] = await transaction
    .select({ participantId: accountParticipants.participantId, status: participants.status })
    .from(accountParticipants)
    .innerJoin(
      participants,
      eq(participants.participantId, accountParticipants.participantId),
    )
    .where(
      and(
        eq(accountParticipants.authUserId, authUserId),
        eq(accountParticipants.role, "learner"),
      ),
    )
    .limit(1);

  if (linked) {
    if (linked.status !== "active") throw new Error("participant_withdrawn");
    return linked.participantId;
  }

  const participant = await createParticipant(transaction, {
    role: "learner",
    consentGivenAt: now,
  });
  const [createdLink] = await transaction
    .insert(accountParticipants)
    .values({
      authUserId,
      role: "learner",
      participantId: participant.participantId,
    })
    .onConflictDoNothing()
    .returning({ participantId: accountParticipants.participantId });

  if (createdLink) return createdLink.participantId;

  await transaction
    .delete(participants)
    .where(eq(participants.participantId, participant.participantId));
  const [existingLink] = await transaction
    .select({ participantId: accountParticipants.participantId })
    .from(accountParticipants)
    .where(
      and(
        eq(accountParticipants.authUserId, authUserId),
        eq(accountParticipants.role, "learner"),
      ),
    )
    .limit(1);
  if (!existingLink) throw new Error("participant_link_unavailable");
  return existingLink.participantId;
}

export async function submitLearnerRequest(
  input: LearnerRequestInput,
  options: { authUserId?: string } = {},
) {
  if (!validDateOnly(input.deadline)) throw new Error("invalid_deadline");
  if (!contactIsValid(input.contactType, input.contact))
    throw new Error("invalid_contact");

  const now = new Date();
  const deadlineEnd = kazakhstanLocalTimeToUtc(`${input.deadline}T23:59`);
  const today = almatyDate(now);
  const eligibleDeadline =
    deadlineEnd !== null &&
    input.deadline >= today &&
    input.deadline <= addCalendarDays(today, 14);

  const windows = input.windows.map(({ start, end }) => {
    const startUtc = kazakhstanLocalTimeToUtc(start);
    const endUtc = kazakhstanLocalTimeToUtc(end);
    return startUtc && endUtc ? { startUtc, endUtc } : null;
  });
  if (
    windows.some(
      (window) =>
        !window || window.startUtc <= now || window.endUtc <= window.startUtc,
    )
  ) {
    throw new Error("invalid_time_window");
  }

  const origin = z
    .enum(["real_pilot", "constructed", "rehearsal"])
    .catch("rehearsal")
    .parse(process.env.SKILLSWAP_DATA_ORIGIN);

  return db.transaction(async (tx) => {
    const learner = options.authUserId
      ? { participantId: await findOrCreateLearnerParticipant(tx, options.authUserId, now) }
      : await createParticipant(tx, { role: "learner", consentGivenAt: now });

    await tx.insert(participantContacts).values({
      participantId: learner.participantId,
      contactType: input.contactType,
      value: input.contact,
    });

    const taskCategory = input.category === "other" ? null : input.category;
    const eventContext = {
      participantId: learner.participantId,
      dataOrigin: origin,
    };
    await recordEvent(tx, eventContext, {
      eventName: "request_submitted",
      experiment: null,
      taskCategory,
      sourceChannel: "web",
    });
    await recordEvent(tx, eventContext, {
      eventName: "eligibility_checked",
      experiment: null,
      taskCategory,
      reasonCode:
        input.category === "other"
          ? "unsupported_category"
          : eligibleDeadline
            ? "eligible"
            : "deadline_outside_14_days",
    });

    if (input.category === "other")
      return { status: "ineligible" as const, reason: "category" as const };

    const [createdRequest] = await tx
      .insert(learnerRequests)
      .values({
        participantId: learner.participantId,
        taskCategory: input.category,
        taskDescription: input.task,
        triedAlready: input.tried,
        deadlineAt: deadlineEnd!,
        preferredWindows: windows.map((window) => ({
          startUtc: window!.startUtc.toISOString(),
          endUtc: window!.endUtc.toISOString(),
        })),
        giveBack: input.giveBack || null,
      })
      .returning({ id: learnerRequests.id });

    const submitted = await transitionLearnerRequest(
      tx,
      createdRequest.id,
      "submitted",
      {
        actor: { type: "participant", participantId: learner.participantId },
        source: "L1",
        reasonCode: "request_submitted",
        at: now,
      },
    );
    if (!submitted.ok) throw new Error("state_conflict");

    if (!eligibleDeadline) {
      const ineligible = await transitionLearnerRequest(
        tx,
        createdRequest.id,
        "ineligible",
        {
          actor: { type: "system" },
          source: "L1",
          reasonCode: "deadline_outside_14_days",
          at: now,
        },
      );
      if (!ineligible.ok) throw new Error("state_conflict");
      return {
        status: "ineligible" as const,
        reason: "deadline" as const,
        requestId: createdRequest.id,
      };
    }

    const eligible = await transitionLearnerRequest(
      tx,
      createdRequest.id,
      "eligible",
      {
        actor: { type: "system" },
        source: "L1",
        reasonCode: "eligibility_checked",
        at: now,
      },
    );
    if (!eligible.ok) throw new Error("state_conflict");
    const privateLink = await createPrivateLink(tx, {
      purpose: "learner_status",
      subjectType: "learner_request",
      subjectId: createdRequest.id,
      expiresAt: new Date(now.getTime() + 30 * 86_400_000),
    });
    return {
      status: "eligible" as const,
      requestId: createdRequest.id,
      token: privateLink.token,
    };
  });
}
