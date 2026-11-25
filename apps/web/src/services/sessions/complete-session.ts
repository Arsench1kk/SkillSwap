import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  feedback,
  learnerRequests,
  matches,
  participants,
  sessions,
} from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";
import { currentDataOrigin } from "@/domain/event-context";
import { recordEvent } from "@/domain/events";
import { createPrivateLink } from "@/domain/private-links";
import { ratingWindowClosesAt } from "@/domain/rating-page";
import { transitionLearnerRequest } from "@/domain/state-machines";

const inputSchema = z
  .object({
    sessionId: z.uuid(),
    operatorId: z.string().regex(/^O-[0-9a-f]{10}$/),
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
    const [operator] = await tx
      .select({ id: participants.participantId })
      .from(participants)
      .where(
        and(
          eq(participants.participantId, operatorId),
          eq(participants.role, "operator"),
          eq(participants.status, "active"),
        ),
      )
      .for("share");
    if (!operator) throw new Error("Active operator required");

    const [reference] = await tx
      .select({ matchId: matches.id, requestId: matches.requestId })
      .from(sessions)
      .innerJoin(matches, eq(sessions.matchId, matches.id))
      .where(eq(sessions.id, sessionId));
    if (!reference) throw new Error("Meeting unavailable");
    // Respect the learner request -> match -> session lock order.
    const [request] = await tx
      .select({
        learner: learnerRequests.participantId,
        status: learnerRequests.status,
      })
      .from(learnerRequests)
      .where(eq(learnerRequests.id, reference.requestId))
      .for("update");
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, reference.matchId))
      .for("update");
    const [session] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .for("update");
    if (
      !request ||
      !match ||
      !session ||
      !match.mentorParticipantId ||
      match.status !== "accepted" ||
      match.humanDecision !== "accepted" ||
      !match.learnerAcceptedAt ||
      !match.mentorAcceptedAt
    ) {
      throw new Error("Meeting unavailable");
    }

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
      if (
        request.status !== "session_scheduled" ||
        (session.completionState !== "scheduled" &&
          session.completionState !== "started")
      ) {
        throw new Error("Meeting unavailable");
      }
      const transition = await transitionLearnerRequest(
        tx,
        reference.requestId,
        "completed",
        {
          actor: { type: "operator", participantId: operator.id },
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
          actorParticipantId: operator.id,
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
