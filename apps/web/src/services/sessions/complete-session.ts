import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { feedback, participants, sessions } from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";
import { currentDataOrigin } from "@/domain/event-context";
import {
  operatorIdSchema,
  requireActiveOperator,
} from "@/domain/operator-access";
import { recordEvent } from "@/domain/events";
import { createPrivateLink } from "@/domain/private-links";
import { ratingWindowClosesAt } from "@/domain/rating-page";
import { transitionLearnerRequest } from "@/domain/state-machines";
import { isOpenSession, lockSession } from "./lock-session";

const inputSchema = z
  .object({
    sessionId: z.uuid(),
    operatorId: operatorIdSchema,
    actualStart: z.date(),
    actualEnd: z.date(),
  })
  .strict()
  .refine(
    ({ actualStart, actualEnd }) =>
      actualStart < actualEnd && actualEnd <= new Date(),
    "Actual times must be in order and already elapsed",
  );

/** Trusted operator CLI entry point. The caller supplies its provisioned actor ID. */
export async function completeSession(
  database: DatabaseExecutor,
  input: z.input<typeof inputSchema>,
) {
  const { sessionId, operatorId, actualStart, actualEnd } =
    inputSchema.parse(input);
  return database.transaction(async (tx) => {
    const actorId = await requireActiveOperator(tx, operatorId);

    const meeting = await lockSession(tx, sessionId);
    if (!meeting || !meeting.match.mentorParticipantId)
      throw new Error("Meeting unavailable");
    const { request, match, session } = meeting;
    if (
      match.status !== "accepted" ||
      match.humanDecision !== "accepted" ||
      !match.learnerAcceptedAt ||
      !match.mentorAcceptedAt
    )
      throw new Error("Meeting unavailable");

    if (session.completionState === "completed") {
      if (
        request.status !== "completed" ||
        session.actualStartsAt?.getTime() !== actualStart.getTime() ||
        session.endsAt?.getTime() !== actualEnd.getTime()
      ) {
        throw new Error(
          "Meeting already completed with different or unavailable actual times",
        );
      }
    } else {
      if (!isOpenSession(meeting)) throw new Error("Meeting unavailable");
      const transition = await transitionLearnerRequest(
        tx,
        request.id,
        "completed",
        {
          actor: { type: "operator", participantId: actorId },
          source: "operator_cli",
          reasonCode: "session_completed",
        },
      );
      if (!transition.ok) throw new Error("Meeting unavailable");
      await tx
        .update(sessions)
        .set({
          actualStartsAt: actualStart,
          endsAt: actualEnd,
          completionState: "completed",
        })
        .where(eq(sessions.id, sessionId));
      await recordEvent(
        tx,
        {
          participantId: request.learner,
          actorParticipantId: actorId,
          dataOrigin: currentDataOrigin(),
          templateVersion: session.templateVersion,
        },
        {
          eventName: "session_completed",
          timestampUtc: actualEnd,
          value: Math.round(
            (actualEnd.getTime() - actualStart.getTime()) / 60_000,
          ),
        },
      );
    }

    const closesAt = ratingWindowClosesAt(actualEnd);
    const expiresAt = new Date(actualEnd.getTime() + 24 * 60 * 60 * 1000);
    if (closesAt.getTime() <= Date.now()) {
      return { ratingLink: null, reason: "window_closed" } as const;
    }

    const [learner] = await tx
      .select({ id: participants.participantId })
      .from(participants)
      .where(
        and(
          eq(participants.participantId, request.learner),
          eq(participants.role, "learner"),
          eq(participants.status, "active"),
        ),
      )
      .for("share");
    if (!learner)
      return { ratingLink: null, reason: "learner_inactive" } as const;

    const [existing] = await tx
      .select({
        id: feedback.id,
        unblocked: feedback.unblocked,
        outcome: feedback.oneLineOutcome,
        trust: feedback.trust,
      })
      .from(feedback)
      .where(
        and(
          eq(feedback.sessionId, sessionId),
          eq(feedback.participantId, learner.id),
        ),
      );
    if (
      existing &&
      existing.unblocked !== null &&
      existing.outcome !== null &&
      existing.trust !== null
    ) {
      return { ratingLink: null, reason: "already_submitted" } as const;
    }

    const id =
      existing?.id ??
      (
        await tx
          .insert(feedback)
          .values({
            sessionId,
            participantId: learner.id,
            unblockedMissingReason: "incomplete",
            outcomeMissingReason: "incomplete",
            trustMissingReason: "incomplete",
            safetyMissingReason: "incomplete",
          })
          .returning({ id: feedback.id })
      )[0].id;
    const ratingLink = await createPrivateLink(tx, {
      purpose: "rating",
      subjectType: "feedback",
      subjectId: id,
      expiresAt,
    });
    return { ratingLink, closesAt, expiresAt };
  });
}
