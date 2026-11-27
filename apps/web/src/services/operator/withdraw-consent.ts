import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { learnerRequests, matches, participants, sessions } from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";
import { currentDataOrigin } from "@/domain/event-context";
import { recordEvent } from "@/domain/events";
import {
  operatorIdSchema,
  requireActiveOperator,
} from "@/domain/operator-access";
import { withdrawParticipantConsent } from "@/domain/participants";

const inputSchema = z
  .object({
    operatorId: operatorIdSchema,
    participantId: z.string().regex(/^[LM]-[0-9a-f]{10}$/),
  })
  .strict();

export async function withdrawConsentByOperator(
  database: DatabaseExecutor,
  input: z.input<typeof inputSchema>,
) {
  const { operatorId, participantId } = inputSchema.parse(input);
  return database.transaction(async (tx) => {
    const actorId = await requireActiveOperator(tx, operatorId);
    const [participant] = await tx
      .select({
        role: participants.role,
        status: participants.status,
      })
      .from(participants)
      .where(eq(participants.participantId, participantId))
      .for("update");
    if (!participant || participant.role === "operator") {
      throw new Error("Participant unavailable");
    }

    const at = new Date();
    const changed = participant.status !== "withdrawn";
    const withdrawn = await withdrawParticipantConsent(tx, participantId, at);
    if (!withdrawn) throw new Error("Participant unavailable");
    if (changed) {
      await recordEvent(
        tx,
        {
          participantId,
          actorParticipantId: actorId,
          dataOrigin: currentDataOrigin(),
        },
        {
          eventName: "consent_withdrawn",
          timestampUtc: at,
        },
      );
    }

    const related =
      participant.role === "learner"
        ? eq(learnerRequests.participantId, participantId)
        : eq(matches.mentorParticipantId, participantId);
    const pendingRequests = await tx
      .selectDistinct({ id: learnerRequests.id })
      .from(learnerRequests)
      .leftJoin(matches, eq(matches.requestId, learnerRequests.id))
      .where(
        and(
          related,
          inArray(learnerRequests.status, [
            "submitted",
            "eligible",
            "matching",
            "matched",
            "session_scheduled",
          ]),
          participant.role === "mentor"
            ? inArray(matches.status, ["proposed", "accepted"])
            : undefined,
        ),
      );
    const pendingSessions = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .innerJoin(matches, eq(matches.id, sessions.matchId))
      .innerJoin(learnerRequests, eq(learnerRequests.id, matches.requestId))
      .where(
        and(
          related,
          inArray(sessions.completionState, ["scheduled", "started"]),
        ),
      );

    return {
      participantId,
      changed,
      withdrawnAt: withdrawn.consentWithdrawnAt ?? (changed ? at : null),
      pendingRequestIds: pendingRequests.map(({ id }) => id),
      pendingSessionIds: pendingSessions.map(({ id }) => id),
    };
  });
}
