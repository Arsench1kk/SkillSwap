import { and, asc, eq, gt, inArray, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { DatabaseExecutor } from "@/db/types";
import {
  learnerRequests,
  matches,
  mentorBriefs,
  participants,
  skillEvidence,
} from "@/db/schema";
import { requireActiveOperator } from "@/domain/operator-access";

export function listUnassignedRequests(
  database: DatabaseExecutor,
  operatorId: string,
) {
  return database.transaction(async (tx) => {
    await requireActiveOperator(tx, operatorId);
    return tx
      .select({
        id: learnerRequests.id,
        category: learnerRequests.taskCategory,
        task: learnerRequests.taskDescription,
        triedAlready: learnerRequests.triedAlready,
        deadlineAt: learnerRequests.deadlineAt,
      })
      .from(learnerRequests)
      .innerJoin(
        participants,
        eq(participants.participantId, learnerRequests.participantId),
      )
      .where(
        and(
          inArray(learnerRequests.status, ["eligible", "matching"]),
          gt(learnerRequests.deadlineAt, new Date()),
          eq(participants.status, "active"),
          eq(participants.role, "learner"),
          notExists(
            tx
              .select({ id: matches.id })
              .from(matches)
              .where(eq(matches.requestId, learnerRequests.id)),
          ),
          notExists(
            tx
              .select({ id: mentorBriefs.id })
              .from(mentorBriefs)
              .where(eq(mentorBriefs.requestId, learnerRequests.id)),
          ),
        ),
      )
      .orderBy(asc(learnerRequests.createdAt), asc(learnerRequests.id))
      .limit(50);
  });
}

export function listVerifiedSkills(
  database: DatabaseExecutor,
  operatorId: string,
  requestId: string,
) {
  return database.transaction(async (tx) => {
    await requireActiveOperator(tx, operatorId);
    const mentor = alias(participants, "mentor");
    return tx
      .select({
        skillId: skillEvidence.id,
        mentorId: skillEvidence.mentorParticipantId,
        topic: skillEvidence.topic,
      })
      .from(learnerRequests)
      .innerJoin(
        skillEvidence,
        sql`${skillEvidence.category}::text = ${learnerRequests.taskCategory}::text`,
      )
      .innerJoin(
        mentor,
        eq(mentor.participantId, skillEvidence.mentorParticipantId),
      )
      .where(
        and(
          eq(learnerRequests.id, z.uuid().parse(requestId)),
          inArray(learnerRequests.status, ["eligible", "matching"]),
          gt(learnerRequests.deadlineAt, new Date()),
          eq(skillEvidence.verificationState, "verified"),
          eq(mentor.status, "active"),
          eq(mentor.role, "mentor"),
        ),
      )
      .orderBy(asc(skillEvidence.topic), asc(skillEvidence.id))
      .limit(50);
  });
}
