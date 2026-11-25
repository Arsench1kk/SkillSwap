import { and, eq, gt, inArray, isNotNull, lte, or } from "drizzle-orm";
import { participants, skillEvidence } from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function readableSkillProof(at: Date) {
  return and(
    isNotNull(skillEvidence.proofReference),
    gt(skillEvidence.createdAt, new Date(at.getTime() - RETENTION_MS)),
  );
}

export async function purgeExpiredSkillProof(
  database: DatabaseExecutor,
  at = new Date(),
) {
  const result = await database
    .update(skillEvidence)
    .set({ proofReference: null })
    .where(
      and(
        isNotNull(skillEvidence.proofReference),
        or(
          lte(skillEvidence.createdAt, new Date(at.getTime() - RETENTION_MS)),
          inArray(
            skillEvidence.mentorParticipantId,
            database
              .select({ id: participants.participantId })
              .from(participants)
              .where(eq(participants.status, "withdrawn")),
          ),
        ),
      ),
    );
  return result.rowCount ?? 0;
}
