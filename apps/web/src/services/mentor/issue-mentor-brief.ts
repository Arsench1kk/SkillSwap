import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  learnerRequests,
  matches,
  mentorBriefs,
  mentorProfiles,
  participants,
  skillEvidence,
} from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";
import { currentDataOrigin } from "@/domain/event-context";
import { containsContactData, recordEvent } from "@/domain/events";
import { studentStatusForMatching } from "@/domain/mentor-student-status";
import {
  operatorIdSchema,
  requireActiveOperator,
} from "@/domain/operator-access";
import {
  createPrivateLink,
  revokeMentorBriefLinks,
} from "@/domain/private-links";
import { transitionLearnerRequest } from "@/domain/state-machines";
import {
  hasRoomForInvitation,
  mentorWasNotInvited,
} from "./invitation-availability";

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

export async function issueMentorBrief(
  database: DatabaseExecutor,
  input: z.input<typeof inputSchema>,
) {
  const { operatorId, requestId, skillId, reason } = inputSchema.parse(input);
  return database.transaction(async (tx) => {
    const actorId = await requireActiveOperator(tx, operatorId);
    // M2 responses and L3 confirmation acquire the brief before the request.
    const [previousBrief] = await tx
      .select({ id: mentorBriefs.id })
      .from(mentorBriefs)
      .where(eq(mentorBriefs.requestId, requestId))
      .orderBy(desc(mentorBriefs.sentAt), desc(mentorBriefs.id))
      .limit(1)
      .for("update");
    const [request] = await tx
      .select()
      .from(learnerRequests)
      .where(eq(learnerRequests.id, requestId))
      .for("update");
    const now = new Date();
    if (
      !request ||
      !["eligible", "matching", "matched"].includes(request.status) ||
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

    const [available] = await tx
      .select({ id: learnerRequests.id })
      .from(learnerRequests)
      .where(and(eq(learnerRequests.id, requestId), hasRoomForInvitation(tx)));
    if (!available)
      throw new Error("Request already has a match or invitation");

    const priorBriefs = await tx
      .select({ id: mentorBriefs.id })
      .from(mentorBriefs)
      .where(eq(mentorBriefs.requestId, requestId))
      .orderBy(desc(mentorBriefs.sentAt), desc(mentorBriefs.id));
    if (priorBriefs[0]?.id !== previousBrief?.id)
      throw new Error("Request already has a match or invitation");

    const [lastPair] = await tx
      .select({ createdAt: matches.createdAt })
      .from(matches)
      .where(eq(matches.requestId, requestId))
      .orderBy(desc(matches.createdAt))
      .limit(1);

    const mentor = alias(participants, "mentor");
    const dataOrigin = currentDataOrigin();
    const [skill] = await tx
      .select({ id: skillEvidence.mentorParticipantId })
      .from(skillEvidence)
      .innerJoin(
        mentor,
        eq(mentor.participantId, skillEvidence.mentorParticipantId),
      )
      .innerJoin(
        mentorProfiles,
        eq(mentorProfiles.participantId, mentor.participantId),
      )
      .where(
        and(
          eq(skillEvidence.id, skillId),
          eq(skillEvidence.category, request.taskCategory),
          eq(skillEvidence.verificationState, "verified"),
          eq(mentor.role, "mentor"),
          eq(mentor.status, "active"),
          studentStatusForMatching(dataOrigin),
          mentorWasNotInvited(tx, mentor.participantId, requestId),
        ),
      )
      .for("share");
    if (!skill) throw new Error("Verified mentor skill unavailable");

    if (request.status !== "matching") {
      const transition = await transitionLearnerRequest(
        tx,
        requestId,
        "matching",
        {
          actor: { type: "operator", participantId: actorId },
          source: "operator_cli",
          reasonCode: priorBriefs.length ? "mentor_replaced" : "mentor_invited",
          at: now,
        },
      );
      if (!transition.ok) throw new Error("Request unavailable");
    }
    if (priorBriefs.length)
      await revokeMentorBriefLinks(
        tx,
        priorBriefs.map(({ id }) => id),
        now,
      );

    // Keep the latest pair unambiguous even for two writes in the same millisecond.
    const createdAt = new Date(
      Math.max(now.getTime(), (lastPair?.createdAt.getTime() ?? 0) + 1),
    );
    await tx.insert(matches).values({
      requestId,
      mentorParticipantId: skill.id,
      humanDecision: "accepted",
      humanDecisionReason: reason,
      createdAt,
    });
    const answerBy = new Date(
      Math.min(createdAt.getTime() + HOURS_48, request.deadlineAt.getTime()),
    );
    const [brief] = await tx
      .insert(mentorBriefs)
      .values({
        requestId,
        mentorParticipantId: skill.id,
        templateVersion: BRIEF_TEMPLATE_VERSION,
        sentAt: createdAt,
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
        dataOrigin,
      },
      {
        eventName: "brief_sent",
        briefType: "S",
        taskCategory: request.taskCategory,
        timestampUtc: now,
      },
    );
    return { link, answerBy, briefId: brief.id };
  });
}
