import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { learnerRequests, matches, participants, sessions } from "@/db/schema";
import { verifyPrivateLink } from "@/domain/private-links";
import { formatKazakhstanTime } from "@/domain/time";

export type SessionPageData = {
  state: "expired" | "ready";
  token: string;
  participantId?: string;
  participantRole?: "learner" | "mentor";
  sessionId?: string;
  matchId?: string;
  templateVersion?: string;
  task?: string;
  startsAt?: string | null;
  meetUrl?: string | null;
  completionState?: string;
};

export async function getSessionPage(token: string): Promise<SessionPageData> {
  const expired: SessionPageData = { state: "expired", token };
  const link = await verifyPrivateLink(db, token);
  if (
    link.status !== "valid" ||
    link.purpose !== "session" ||
    link.subjectType !== "participant"
  )
    return expired;
  const [participant] = await db
    .select({
      id: participants.participantId,
      role: participants.role,
      status: participants.status,
    })
    .from(participants)
    .where(eq(participants.participantId, link.subjectId))
    .limit(1);
  if (
    !participant ||
    participant.status !== "active" ||
    !["learner", "mentor"].includes(participant.role)
  )
    return expired;

  const [session] = await db
    .select({
      id: sessions.id,
      matchId: matches.id,
      templateVersion: sessions.templateVersion,
      startsAt: sessions.startsAt,
      meetUrl: sessions.meetUrl,
      completionState: sessions.completionState,
      task: learnerRequests.taskDescription,
    })
    .from(sessions)
    .innerJoin(matches, eq(matches.id, sessions.matchId))
    .innerJoin(learnerRequests, eq(learnerRequests.id, matches.requestId))
    .where(
      and(
        eq(matches.status, "accepted"),
        participant.role === "learner"
          ? eq(learnerRequests.participantId, participant.id)
          : eq(matches.mentorParticipantId, participant.id),
      ),
    )
    .limit(1);
  if (!session) return expired;
  const meetUrl =
    session.meetUrl && /^https:\/\/meet\.google\.com\//.test(session.meetUrl)
      ? session.meetUrl
      : null;
  return {
    state: "ready",
    token,
    participantId: participant.id,
    participantRole: participant.role as "learner" | "mentor",
    sessionId: session.id,
    matchId: session.matchId,
    templateVersion: session.templateVersion,
    task: session.task,
    startsAt: session.startsAt
      ? formatKazakhstanTime(session.startsAt, "en")
      : null,
    meetUrl,
    completionState: session.completionState,
  };
}
