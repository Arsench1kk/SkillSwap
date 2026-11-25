import { and, eq, isNotNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { learnerRequests, matches, participants, sessions } from "@/db/schema";
import {
  verifyPrivateLink,
  type LinkVerification,
} from "@/domain/private-links";
import type { DatabaseExecutor } from "@/db/types";
import { googleMeetUrl } from "../services/sessions/publish-session";
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

export async function resolveSessionLink(
  link: LinkVerification,
  database: DatabaseExecutor,
) {
  if (link.status !== "valid" || link.purpose !== "session") return null;
  const scoped = link.subjectType === "session";
  const recipient = scoped
    ? link.recipientParticipantId
    : link.subjectType === "participant"
      ? link.subjectId
      : undefined;
  if (!recipient) return null;
  const [participant] = await database
    .select({
      id: participants.participantId,
      role: participants.role,
      status: participants.status,
    })
    .from(participants)
    .where(eq(participants.participantId, recipient))
    .limit(1);
  if (
    !participant ||
    participant.status !== "active" ||
    (participant.role !== "learner" && participant.role !== "mentor")
  )
    return null;

  const rows = await database
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
        participant.role === "learner"
          ? eq(learnerRequests.participantId, participant.id)
          : eq(matches.mentorParticipantId, participant.id),
        scoped
          ? and(
              eq(sessions.id, link.subjectId),
              eq(matches.humanDecision, "accepted"),
              isNotNull(matches.learnerAcceptedAt),
              isNotNull(matches.mentorAcceptedAt),
              or(
                eq(matches.status, "accepted"),
                and(
                  eq(matches.status, "withdrawn"),
                  eq(sessions.completionState, "cancelled"),
                ),
              ),
            )
          : eq(matches.status, "accepted"),
      ),
    )
    .limit(scoped ? 1 : 2);
  if (rows.length !== 1) return null;
  return { participant, session: rows[0] };
}

export async function getSessionPage(
  token: string,
  database: DatabaseExecutor = db,
): Promise<SessionPageData> {
  const resolved = await resolveSessionLink(
    await verifyPrivateLink(database, token),
    database,
  );
  if (!resolved) return { state: "expired", token };
  const { participant, session } = resolved;
  const meet = googleMeetUrl.safeParse(session.meetUrl);
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
    meetUrl:
      meet.success && session.completionState !== "cancelled"
        ? meet.data
        : null,
    completionState: session.completionState,
  };
}
