import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  feedback,
  mentorBriefs,
  learnerRequests,
  participants,
} from "@/db/schema";
import { verifyPrivateLink } from "@/domain/private-links";

export async function getReportParticipant(token: string) {
  const link = await verifyPrivateLink(db, token);
  if (link.status !== "valid") return null;
  if (link.subjectType === "participant") {
    const [person] = await db
      .select({
        id: participants.participantId,
        role: participants.role,
        status: participants.status,
      })
      .from(participants)
      .where(eq(participants.participantId, link.subjectId))
      .limit(1);
    return person?.status === "active" && person.role !== "operator"
      ? person
      : null;
  }
  if (
    link.subjectType === "learner_request" &&
    link.purpose === "learner_status"
  ) {
    const [request] = await db
      .select({
        id: participants.participantId,
        role: participants.role,
        status: participants.status,
      })
      .from(learnerRequests)
      .innerJoin(
        participants,
        eq(participants.participantId, learnerRequests.participantId),
      )
      .where(eq(learnerRequests.id, link.subjectId))
      .limit(1);
    return request?.status === "active" ? request : null;
  }
  if (link.subjectType === "mentor_brief" && link.purpose === "mentor_brief") {
    const [mentor] = await db
      .select({
        id: participants.participantId,
        role: participants.role,
        status: participants.status,
      })
      .from(mentorBriefs)
      .innerJoin(
        participants,
        eq(participants.participantId, mentorBriefs.mentorParticipantId),
      )
      .where(eq(mentorBriefs.id, link.subjectId))
      .limit(1);
    return mentor?.status === "active" ? mentor : null;
  }
  if (link.subjectType === "feedback" && link.purpose === "rating") {
    const [person] = await db
      .select({
        id: participants.participantId,
        role: participants.role,
        status: participants.status,
      })
      .from(feedback)
      .innerJoin(
        participants,
        eq(participants.participantId, feedback.participantId),
      )
      .where(eq(feedback.id, link.subjectId))
      .limit(1);
    return person?.status === "active" ? person : null;
  }
  return null;
}
