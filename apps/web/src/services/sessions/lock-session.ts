import { eq } from "drizzle-orm";
import { learnerRequests, matches, sessions } from "@/db/schema";
import type { DatabaseTransaction } from "@/db/types";

/** Respect the request -> match -> session order shared by outcome writers. */
export async function lockSession(tx: DatabaseTransaction, sessionId: string) {
  const [reference] = await tx
    .select({ matchId: matches.id, requestId: matches.requestId })
    .from(sessions)
    .innerJoin(matches, eq(sessions.matchId, matches.id))
    .where(eq(sessions.id, sessionId));
  if (!reference) return null;

  const [request] = await tx
    .select({
      id: learnerRequests.id,
      learner: learnerRequests.participantId,
      status: learnerRequests.status,
    })
    .from(learnerRequests)
    .where(eq(learnerRequests.id, reference.requestId))
    .for("update");
  const [match] = await tx
    .select()
    .from(matches)
    .where(eq(matches.id, reference.matchId))
    .for("update");
  const [session] = await tx
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .for("update");

  if (!request || !match || !session) return null;
  return { request, match, session };
}

export function isOpenSession({
  request,
  match,
  session,
}: NonNullable<Awaited<ReturnType<typeof lockSession>>>) {
  return (
    request.status === "session_scheduled" &&
    match.status === "accepted" &&
    match.humanDecision === "accepted" &&
    match.mentorParticipantId !== null &&
    match.learnerAcceptedAt !== null &&
    match.mentorAcceptedAt !== null &&
    (session.completionState === "scheduled" ||
      session.completionState === "started")
  );
}
