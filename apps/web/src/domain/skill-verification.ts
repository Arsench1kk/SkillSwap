import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { participants, skillEvidence } from "@/db/schema";

export async function setSkillVerification(
  database: NodePgDatabase<typeof schema>,
  input: {
    skillEvidenceId: string;
    operatorParticipantId: string;
    state: (typeof schema.skillVerificationState.enumValues)[number];
    at?: Date;
  },
) {
  const [operator] = await database
    .select({ role: participants.role })
    .from(participants)
    .where(eq(participants.participantId, input.operatorParticipantId))
    .limit(1);
  if (!operator || operator.role !== "operator") {
    throw new Error("Only an operator may set skill verification state");
  }

  const [updated] = await database
    .update(skillEvidence)
    .set({
      verificationState: input.state,
      verifiedAt: input.state === "pending" ? null : (input.at ?? new Date()),
      verifiedBy:
        input.state === "pending" ? null : input.operatorParticipantId,
    })
    .where(eq(skillEvidence.id, input.skillEvidenceId))
    .returning();
  return updated ?? null;
}
