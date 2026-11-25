import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { participants, skillEvidence } from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";
import { currentDataOrigin } from "./event-context";
import { recordEvent, skillVerificationDecision } from "./events";
import { operatorIdSchema, requireActiveOperator } from "./operator-access";

const verificationSchema = z
  .object({
    skillEvidenceId: z.uuid(),
    operatorParticipantId: operatorIdSchema,
    state: skillVerificationDecision,
  })
  .strict();

export async function setSkillVerification(
  database: DatabaseExecutor,
  input: z.input<typeof verificationSchema>,
) {
  const { skillEvidenceId, operatorParticipantId, state } =
    verificationSchema.parse(input);
  return database.transaction(async (tx) => {
    const operatorId = await requireActiveOperator(tx, operatorParticipantId);
    const [mentor] = await tx
      .select({ id: participants.participantId })
      .from(participants)
      .innerJoin(
        skillEvidence,
        eq(skillEvidence.mentorParticipantId, participants.participantId),
      )
      .where(
        and(
          eq(skillEvidence.id, skillEvidenceId),
          eq(participants.role, "mentor"),
          eq(participants.status, "active"),
        ),
      )
      .for("share", { of: participants });
    if (!mentor) return null;

    const at = new Date();
    const [updated] = await tx
      .update(skillEvidence)
      .set({
        verificationState: state,
        verifiedAt: at,
        verifiedBy: operatorId,
      })
      .where(
        and(
          eq(skillEvidence.id, skillEvidenceId),
          eq(skillEvidence.verificationState, "pending"),
        ),
      )
      .returning({
        skillId: skillEvidence.id,
        state: skillEvidence.verificationState,
        decidedAt: skillEvidence.verifiedAt,
      });
    if (!updated) return null;

    await recordEvent(
      tx,
      {
        participantId: mentor.id,
        actorParticipantId: operatorId,
        dataOrigin: currentDataOrigin(),
      },
      {
        eventName: "skill_verification_decided",
        reasonCode: state,
        timestampUtc: at,
      },
    );
    return updated;
  });
}
