import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { mentorProfiles, participants, skillEvidence } from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";
import { requireActiveOperator } from "@/domain/operator-access";
import { readableSkillProof } from "@/domain/skill-proof-retention";

const pendingActiveMentor = and(
  eq(skillEvidence.verificationState, "pending"),
  eq(participants.role, "mentor"),
  eq(participants.status, "active"),
);

export function listPendingSkillEvidence(
  database: DatabaseExecutor,
  operatorId: string,
) {
  return database.transaction(async (tx) => {
    await requireActiveOperator(tx, operatorId);
    return tx
      .select({
        skillId: skillEvidence.id,
        category: skillEvidence.category,
        topic: skillEvidence.topic,
        submittedAt: skillEvidence.createdAt,
      })
      .from(skillEvidence)
      .innerJoin(
        participants,
        eq(participants.participantId, skillEvidence.mentorParticipantId),
      )
      .where(and(pendingActiveMentor, readableSkillProof(new Date())))
      .orderBy(asc(skillEvidence.createdAt), asc(skillEvidence.id))
      .limit(50);
  });
}

export function getPendingSkillProof(
  database: DatabaseExecutor,
  operatorId: string,
  skillId: string,
) {
  const id = z.uuid().parse(skillId);
  return database.transaction(async (tx) => {
    await requireActiveOperator(tx, operatorId);
    const [proof] = await tx
      .select({
        skillId: skillEvidence.id,
        mentorId: skillEvidence.mentorParticipantId,
        category: skillEvidence.category,
        topic: skillEvidence.topic,
        proofType: skillEvidence.proofType,
        proofReference: skillEvidence.proofReference,
      })
      .from(skillEvidence)
      .innerJoin(
        participants,
        eq(participants.participantId, skillEvidence.mentorParticipantId),
      )
      .where(
        and(
          pendingActiveMentor,
          eq(skillEvidence.id, id),
          readableSkillProof(new Date()),
        ),
      );
    return proof ?? null;
  });
}

export function listPendingStudentVerifications(
  database: DatabaseExecutor,
  operatorId: string,
) {
  return database.transaction(async (tx) => {
    await requireActiveOperator(tx, operatorId);
    return tx
      .select({ mentorId: mentorProfiles.participantId })
      .from(mentorProfiles)
      .innerJoin(
        participants,
        eq(participants.participantId, mentorProfiles.participantId),
      )
      .where(
        and(
          isNull(mentorProfiles.studentStatusVerified),
          eq(participants.status, "active"),
          eq(participants.role, "mentor"),
        ),
      )
      .orderBy(asc(mentorProfiles.createdAt), asc(mentorProfiles.participantId))
      .limit(50);
  });
}
