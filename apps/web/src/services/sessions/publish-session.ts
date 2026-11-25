import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseExecutor } from "@/db/types";
import { learnerRequests, matches, participants, sessions } from "@/db/schema";
import { createPrivateLink } from "@/domain/private-links";

export const googleMeetUrl = z
  .string()
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return (
      url.origin === "https://meet.google.com" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname !== "/"
    );
  }, "Enter a Google Meet meeting URL");

const publishInput = z
  .object({
    sessionId: z.uuid(),
    meetUrl: googleMeetUrl,
  })
  .strict();

const DAY_MS = 24 * 60 * 60 * 1000;

/** Called only from the trusted operator command. All writes succeed together. */
export async function publishSession(
  database: DatabaseExecutor,
  input: z.input<typeof publishInput>,
) {
  const { sessionId, meetUrl } = publishInput.parse(input);
  return database.transaction(async (tx) => {
    const [reference] = await tx
      .select({ matchId: sessions.matchId })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    if (!reference) throw new Error("Meeting unavailable");

    const [match] = await tx
      .select({
        learner: learnerRequests.participantId,
        mentor: matches.mentorParticipantId,
      })
      .from(matches)
      .innerJoin(learnerRequests, eq(learnerRequests.id, matches.requestId))
      .where(
        and(
          eq(matches.id, reference.matchId),
          eq(matches.status, "accepted"),
          eq(matches.humanDecision, "accepted"),
          isNotNull(matches.learnerAcceptedAt),
          isNotNull(matches.mentorAcceptedAt),
        ),
      )
      .for("update", { of: matches });
    if (!match?.mentor) throw new Error("Meeting unavailable");

    const [session] = await tx
      .select({ startsAt: sessions.startsAt })
      .from(sessions)
      .where(
        and(
          eq(sessions.id, sessionId),
          inArray(sessions.completionState, ["scheduled", "started"]),
        ),
      )
      .for("update");
    if (!session?.startsAt) throw new Error("Meeting unavailable");

    const recipients = await tx
      .select({
        id: participants.participantId,
        role: participants.role,
      })
      .from(participants)
      .where(
        and(
          inArray(participants.participantId, [match.learner, match.mentor]),
          eq(participants.status, "active"),
        ),
      );
    if (
      !recipients.some((p) => p.id === match.learner && p.role === "learner") ||
      !recipients.some((p) => p.id === match.mentor && p.role === "mentor")
    ) {
      throw new Error("Meeting unavailable");
    }

    const expiresAt = new Date(session.startsAt.getTime() + DAY_MS);
    await tx
      .update(sessions)
      .set({ meetUrl })
      .where(eq(sessions.id, sessionId));
    const issue = (recipientParticipantId: string) =>
      createPrivateLink(tx, {
        purpose: "session",
        subjectType: "session",
        subjectId: sessionId,
        recipientParticipantId,
        expiresAt,
      });
    const learner = await issue(match.learner);
    const mentor = await issue(match.mentor);
    return { learner, mentor, expiresAt };
  });
}
