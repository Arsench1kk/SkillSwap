import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { DatabaseExecutor } from "@/db/types";
import {
  learnerRequests,
  mentorProfiles,
  participants,
  skillEvidence,
} from "@/db/schema";
import { currentDataOrigin } from "@/domain/event-context";
import { studentStatusForMatching } from "@/domain/mentor-student-status";
import { requireActiveOperator } from "@/domain/operator-access";
import { expireUnansweredInvitations } from "../mentor/expire-unanswered-invitations";
import {
  hasRoomForInvitation,
  mentorWasNotInvited,
} from "../mentor/invitation-availability";

export function listUnassignedRequests(
  database: DatabaseExecutor,
  operatorId: string,
) {
  return database.transaction(async (tx) => {
    await requireActiveOperator(tx, operatorId);
    const now = new Date();
    await expireUnansweredInvitations(tx, now);
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
          inArray(learnerRequests.status, ["eligible", "matching", "matched"]),
          gt(learnerRequests.deadlineAt, now),
          eq(participants.status, "active"),
          eq(participants.role, "learner"),
          hasRoomForInvitation(tx),
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
      .innerJoin(
        mentorProfiles,
        eq(mentorProfiles.participantId, mentor.participantId),
      )
      .where(
        and(
          eq(learnerRequests.id, z.uuid().parse(requestId)),
          inArray(learnerRequests.status, ["eligible", "matching", "matched"]),
          gt(learnerRequests.deadlineAt, new Date()),
          eq(skillEvidence.verificationState, "verified"),
          eq(mentor.status, "active"),
          eq(mentor.role, "mentor"),
          studentStatusForMatching(currentDataOrigin()),
          hasRoomForInvitation(tx),
          mentorWasNotInvited(tx, mentor.participantId),
        ),
      )
      .orderBy(asc(skillEvidence.topic), asc(skillEvidence.id))
      .limit(50);
  });
}
