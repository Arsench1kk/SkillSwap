import { eq } from "drizzle-orm";
import { z } from "zod";
import { matches, sessions } from "@/db/schema";
import type { DatabaseTransaction } from "@/db/types";

/** The existing four-step, 45-minute L4 plan; independent of the brief version. */
export const SESSION_TEMPLATE_VERSION = "l4-v1";

/**
 * Server-only command: callers authorize the participant/operator before entry.
 * Use the caller's confirmation transaction, never a separate connection.
 * Lock order is brief -> request -> match -> session; a caller holding the first
 * three locks can safely enter here. The match lock serializes all creators.
 */
export async function ensureScheduledSession(
  tx: DatabaseTransaction,
  matchId: string,
) {
  z.string().uuid().parse(matchId);
  const [match] = await tx
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .for("update")
    .limit(1);
  if (
    !match ||
    match.status !== "accepted" ||
    match.humanDecision !== "accepted" ||
    !match.mentorParticipantId ||
    !match.mentorAcceptedAt ||
    !match.learnerAcceptedAt ||
    !match.proposedSlotAt
  ) {
    throw new Error("accepted_match_with_slot_required");
  }
  const [existing] = await tx
    .select()
    .from(sessions)
    .where(eq(sessions.matchId, matchId))
    .limit(1);
  if (existing) return existing;

  const [created] = await tx
    .insert(sessions)
    .values({
      matchId,
      startsAt: match.proposedSlotAt,
      templateVersion: SESSION_TEMPLATE_VERSION,
      completionState: "scheduled",
      // Meet is added by the operator; actual completion is not yet known.
    })
    .returning();
  return created;
}
