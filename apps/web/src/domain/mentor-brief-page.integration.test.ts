import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { db, pool } from "@/db/client";
import {
  events,
  learnerRequests,
  mentorBriefs,
  mentorProfiles,
  stateTransitions,
} from "@/db/schema";
import { getMentorBriefPage } from "./mentor-brief-page";
import { createParticipant } from "./participants";
import { createPrivateLink } from "./private-links";

const DAY = 86_400_000;

// Events are append-only, so this synthetic fixture is not deleted; it only
// ever touches its own participants, as in first-invitation.integration.test.
async function createInvitedBrief() {
  const now = Date.now();
  const learner = await createParticipant(db, {
    role: "learner",
    consentGivenAt: new Date(now),
  });
  const mentor = await createParticipant(db, {
    role: "mentor",
    consentGivenAt: new Date(now),
    yearOfStudy: 3,
  });
  await db
    .insert(mentorProfiles)
    .values({ participantId: mentor.participantId, displayName: "Synthetic" });
  const [request] = await db
    .insert(learnerRequests)
    .values({
      participantId: learner.participantId,
      taskCategory: "STEM",
      taskDescription: "SYNTHETIC BRIEF VIEW TEST",
      triedAlready: "SYNTHETIC ATTEMPT",
      deadlineAt: new Date(now + 5 * DAY),
      preferredWindows: [
        {
          startUtc: new Date(now + 2 * DAY).toISOString(),
          endUtc: new Date(now + 2 * DAY + 3_600_000).toISOString(),
        },
      ],
      status: "matching",
    })
    .returning();
  const [brief] = await db
    .insert(mentorBriefs)
    .values({
      requestId: request.id,
      mentorParticipantId: mentor.participantId,
      templateVersion: "brief-view-test-v1",
      sentAt: new Date(now),
      answerBy: new Date(now + DAY),
      status: "invited",
    })
    .returning();
  const link = await createPrivateLink(db, {
    purpose: "mentor_brief",
    subjectType: "mentor_brief",
    subjectId: brief.id,
    expiresAt: brief.answerBy,
  });
  return { mentor, brief, token: link.token };
}

describe.skipIf(!process.env.DATABASE_URL)(
  "mentor brief page view recording",
  () => {
    afterAll(() => pool.end());

    it("records exactly one mentor_viewed with the viewed status, also on a second open", async () => {
      vi.stubEnv("SKILLSWAP_DATA_ORIGIN", "rehearsal");
      const { mentor, brief, token } = await createInvitedBrief();

      const viewedEvents = () =>
        db
          .select()
          .from(events)
          .where(
            and(
              eq(events.participantId, mentor.participantId),
              eq(events.eventName, "mentor_viewed"),
            ),
          );
      const briefStatus = async () =>
        (
          await db
            .select({ status: mentorBriefs.status })
            .from(mentorBriefs)
            .where(eq(mentorBriefs.id, brief.id))
        )[0]?.status;

      const first = await getMentorBriefPage(token);
      expect(first.state).toBe("unanswered");
      expect(await briefStatus()).toBe("viewed");
      const afterFirst = await viewedEvents();
      expect(afterFirst).toHaveLength(1);
      expect(afterFirst[0]).toMatchObject({
        role: "mentor",
        templateVersion: "brief-view-test-v1",
        dataOrigin: "rehearsal",
      });

      // The audit row and the event share one server timestamp.
      const [audit] = await db
        .select()
        .from(stateTransitions)
        .where(
          and(
            eq(stateTransitions.subjectId, brief.id),
            eq(stateTransitions.toState, "viewed"),
          ),
        );
      expect(audit.transitionedAt.getTime()).toBe(
        afterFirst[0].timestampUtc.getTime(),
      );

      const second = await getMentorBriefPage(token);
      expect(second.state).toBe("unanswered");
      expect(await briefStatus()).toBe("viewed");
      expect(await viewedEvents()).toHaveLength(1);
      vi.unstubAllEnvs();
    });
  },
);
