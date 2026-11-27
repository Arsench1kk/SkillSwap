import { and, eq, notExists, notInArray, type SQLWrapper } from "drizzle-orm";
import { learnerRequests, matches, mentorBriefs } from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";

export function hasRoomForInvitation(database: DatabaseExecutor) {
  return and(
    notExists(
      database
        .select({ id: matches.id })
        .from(matches)
        .where(
          and(
            eq(matches.requestId, learnerRequests.id),
            notInArray(matches.status, ["declined", "withdrawn", "expired"]),
          ),
        ),
    ),
    notExists(
      database
        .select({ id: mentorBriefs.id })
        .from(mentorBriefs)
        .where(
          and(
            eq(mentorBriefs.requestId, learnerRequests.id),
            notInArray(mentorBriefs.status, [
              "declined",
              "withdrawn",
              "no_reply",
              "expired",
            ]),
          ),
        ),
    ),
  );
}

export function mentorWasNotInvited(
  database: DatabaseExecutor,
  mentorId: SQLWrapper,
  requestId: string | SQLWrapper = learnerRequests.id,
) {
  return and(
    notExists(
      database
        .select({ id: matches.id })
        .from(matches)
        .where(
          and(
            eq(matches.requestId, requestId),
            eq(matches.mentorParticipantId, mentorId),
          ),
        ),
    ),
    notExists(
      database
        .select({ id: mentorBriefs.id })
        .from(mentorBriefs)
        .where(
          and(
            eq(mentorBriefs.requestId, requestId),
            eq(mentorBriefs.mentorParticipantId, mentorId),
          ),
        ),
    ),
  );
}
