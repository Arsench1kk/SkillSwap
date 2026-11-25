import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { participants, skillEvidence } from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";
import { requireActiveOperator } from "@/domain/operator-access";

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
      .where(pendingActiveMentor)
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
      .where(and(pendingActiveMentor, eq(skillEvidence.id, id)));
    return proof ?? null;
  });
}
