import { and, eq, exists, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  learnerRequests,
  matches,
  mentorBriefs,
  participants,
  skillEvidence,
} from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";
import { currentDataOrigin } from "@/domain/event-context";
import { containsContactData, recordEvent } from "@/domain/events";
import {
  operatorIdSchema,
  requireActiveOperator,
} from "@/domain/operator-access";
import { createPrivateLink } from "@/domain/private-links";
import { transitionLearnerRequest } from "@/domain/state-machines";

const inputSchema = z
  .object({
    operatorId: operatorIdSchema,
    requestId: z.uuid(),
    skillId: z.uuid(),
    reason: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .refine((value) => !containsContactData(value)),
  })
  .strict();

export const BRIEF_TEMPLATE_VERSION = "m2-v1";
const HOURS_48 = 48 * 60 * 60 * 1000;

export async function issueFirstBrief(
  database: DatabaseExecutor,
  input: z.input<typeof inputSchema>,
) {
  const { operatorId, requestId, skillId, reason } = inputSchema.parse(input);
  return database.transaction(async (tx) => {
    const actorId = await requireActiveOperator(tx, operatorId);
    const [request] = await tx
      .select()
      .from(learnerRequests)
      .where(eq(learnerRequests.id, requestId))
      .for("update");
    const now = new Date();
    if (
      !request ||
      (request.status !== "matching" && request.status !== "eligible") ||
      request.deadlineAt <= now ||
      !request.preferredWindows.some((window) => {
        const start = new Date(window.startUtc);
        return start > now && start <= request.deadlineAt;
      })
    )
      throw new Error("Request unavailable");
    const [learner] = await tx
      .select({ id: participants.participantId })
      .from(participants)
      .where(
        and(
          eq(participants.participantId, request.participantId),
          eq(participants.role, "learner"),
          eq(participants.status, "active"),
        ),
      )
      .for("share");
    if (!learner) throw new Error("Request unavailable");

    const [prior] = await tx
      .select({ id: learnerRequests.id })
      .from(learnerRequests)
      .where(
        and(
          eq(learnerRequests.id, requestId),
          or(
            exists(
              tx
                .select({ id: matches.id })
                .from(matches)
                .where(eq(matches.requestId, requestId)),
            ),
            exists(
              tx
                .select({ id: mentorBriefs.id })
                .from(mentorBriefs)
                .where(eq(mentorBriefs.requestId, requestId)),
            ),
          ),
        ),
      );
    if (prior) throw new Error("Request already has a match or invitation");

    const mentor = alias(participants, "mentor");
    const [skill] = await tx
      .select({ id: skillEvidence.mentorParticipantId })
      .from(skillEvidence)
      .innerJoin(
        mentor,
        eq(mentor.participantId, skillEvidence.mentorParticipantId),
      )
      .where(
        and(
          eq(skillEvidence.id, skillId),
          eq(skillEvidence.category, request.taskCategory),
          eq(skillEvidence.verificationState, "verified"),
          eq(mentor.role, "mentor"),
          eq(mentor.status, "active"),
        ),
      )
      .for("share");
    if (!skill) throw new Error("Verified mentor skill unavailable");

    if (request.status === "eligible") {
      const transition = await transitionLearnerRequest(
        tx,
        requestId,
        "matching",
        {
          actor: { type: "operator", participantId: actorId },
          source: "operator_cli",
          reasonCode: "mentor_invited",
          at: now,
        },
      );
      if (!transition.ok) throw new Error("Request unavailable");
    }
    await tx.insert(matches).values({
      requestId,
      mentorParticipantId: skill.id,
      humanDecision: "accepted",
      humanDecisionReason: reason,
    });
    const answerBy = new Date(
      Math.min(now.getTime() + HOURS_48, request.deadlineAt.getTime()),
    );
    const [brief] = await tx
      .insert(mentorBriefs)
      .values({
        requestId,
        mentorParticipantId: skill.id,
        templateVersion: BRIEF_TEMPLATE_VERSION,
        sentAt: now,
        answerBy,
      })
      .returning({ id: mentorBriefs.id });
    const link = await createPrivateLink(tx, {
      purpose: "mentor_brief",
      subjectType: "mentor_brief",
      subjectId: brief.id,
      expiresAt: answerBy,
    });
    await recordEvent(
      tx,
      {
        participantId: skill.id,
        actorParticipantId: actorId,
        templateVersion: BRIEF_TEMPLATE_VERSION,
        dataOrigin: currentDataOrigin(),
      },
      {
        eventName: "brief_sent",
        briefType: "S",
        taskCategory: request.taskCategory,
        timestampUtc: now,
      },
    );
    return { link, answerBy };
  });
}
