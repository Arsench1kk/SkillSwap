import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { mentorProfiles, participants } from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";
import { currentDataOrigin } from "./event-context";
import { operatorVerificationDecision, recordEvent } from "./events";
import { operatorIdSchema, requireActiveOperator } from "./operator-access";

const decisionSchema = z
  .object({
    operatorId: operatorIdSchema,
    mentorId: z.string().regex(/^M-[0-9a-f]{10}$/),
    state: operatorVerificationDecision,
  })
  .strict();

export function studentStatusForMatching(
  origin: ReturnType<typeof currentDataOrigin>,
) {
  return origin === "real_pilot"
    ? eq(mentorProfiles.studentStatusVerified, true)
    : undefined;
}

export async function setMentorStudentStatus(
  database: DatabaseExecutor,
  input: z.input<typeof decisionSchema>,
) {
  const { operatorId, mentorId, state } = decisionSchema.parse(input);
  return database.transaction(async (tx) => {
    const actorId = await requireActiveOperator(tx, operatorId);
    const [mentor] = await tx
      .select({ id: participants.participantId })
      .from(participants)
      .where(
        and(
          eq(participants.participantId, mentorId),
          eq(participants.role, "mentor"),
          eq(participants.status, "active"),
        ),
      )
      .for("share");
    if (!mentor) return null;

    const verified = state === "verified";
    const at = new Date();
    const [updated] = await tx
      .update(mentorProfiles)
      .set({
        studentStatusVerified: verified,
        studentStatusCheckedAt: at,
        studentStatusCheckedBy: actorId,
      })
      .where(
        and(
          eq(mentorProfiles.participantId, mentor.id),
          sql`${mentorProfiles.studentStatusVerified} is distinct from ${verified}`,
        ),
      )
      .returning({ mentorId: mentorProfiles.participantId });
    if (!updated) return null;

    await recordEvent(
      tx,
      {
        participantId: mentor.id,
        actorParticipantId: actorId,
        dataOrigin: currentDataOrigin(),
      },
      {
        eventName: "mentor_student_status_decided",
        reasonCode: state,
        timestampUtc: at,
      },
    );
    return updated;
  });
}
