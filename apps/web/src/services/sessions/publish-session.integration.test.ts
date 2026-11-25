import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db/client";
import {
  learnerRequests,
  linkTokens,
  matches,
  mentorProfiles,
  sessions,
} from "@/db/schema";
import { createParticipant } from "@/domain/participants";
import { createPrivateLink, verifyPrivateLink } from "@/domain/private-links";
import { getReportParticipant } from "@/domain/report-page";
import { getSessionPage } from "@/domain/session-page";
import { publishSession } from "./publish-session";

const meetUrl = "https://meet.google.com/test-meeting";
const hour = 3_600_000;

async function pair() {
  const consentGivenAt = new Date();
  const learner = await createParticipant(db, {
    role: "learner",
    consentGivenAt,
  });
  const mentor = await createParticipant(db, {
    role: "mentor",
    consentGivenAt,
  });
  await db
    .insert(mentorProfiles)
    .values({ participantId: mentor.participantId });
  async function schedule(taskDescription: string, startsAt: Date) {
    const [request] = await db
      .insert(learnerRequests)
      .values({
        participantId: learner.participantId,
        taskDescription,
        taskCategory: "STEM",
        triedAlready: "Checked the example.",
        deadlineAt: new Date(Date.now() + 48 * hour),
        preferredWindows: [],
        status: "session_scheduled",
      })
      .returning();
    const [match] = await db
      .insert(matches)
      .values({
        requestId: request.id,
        mentorParticipantId: mentor.participantId,
        humanDecision: "accepted",
        status: "accepted",
        learnerAcceptedAt: consentGivenAt,
        mentorAcceptedAt: consentGivenAt,
        proposedSlotAt: startsAt,
      })
      .returning();
    const [session] = await db
      .insert(sessions)
      .values({
        matchId: match.id,
        startsAt,
        templateVersion: "l4-v1",
      })
      .returning();
    return session;
  }
  return { learner, mentor, schedule };
}

describe.skipIf(!process.env.DATABASE_URL)(
  "operator meeting publication",
  () => {
    afterAll(() => pool.end());

    it("issues two private links for the selected meeting and retains unambiguous legacy access", async () => {
      const { learner, mentor, schedule } = await pair();
      const first = await schedule(
        "Review the first draft",
        new Date(Date.now() + hour),
      );
      const legacy = await createPrivateLink(db, {
        purpose: "session",
        subjectType: "participant",
        subjectId: learner.participantId,
        expiresAt: new Date(Date.now() + hour),
      });
      await expect(getSessionPage(legacy.token)).resolves.toMatchObject({
        sessionId: first.id,
      });

      const other = await schedule(
        "Review the second draft",
        new Date(Date.now() + 2 * hour),
      );
      const links = await publishSession(db, { sessionId: other.id, meetUrl });
      expect(links.learner.token).not.toBe(links.mentor.token);
      expect(links.expiresAt.getTime()).toBe(
        other.startsAt!.getTime() + 24 * hour,
      );
      await expect(getSessionPage(legacy.token)).resolves.toMatchObject({
        state: "expired",
      });
      for (const [link, person] of [
        [links.learner, learner],
        [links.mentor, mentor],
      ] as const) {
        await expect(getSessionPage(link.token)).resolves.toMatchObject({
          state: "ready",
          sessionId: other.id,
          participantId: person.participantId,
          meetUrl,
        });
        await expect(getReportParticipant(link.token)).resolves.toMatchObject({
          id: person.participantId,
        });
        await expect(
          verifyPrivateLink(db, link.token, links.expiresAt),
        ).resolves.toEqual({ status: "expired" });
      }
      const stranger = await createParticipant(db, {
        role: "learner",
        consentGivenAt: new Date(),
      });
      const mismatched = await createPrivateLink(db, {
        purpose: "session",
        subjectType: "session",
        subjectId: other.id,
        recipientParticipantId: stranger.participantId,
        expiresAt: links.expiresAt,
      });
      await expect(getSessionPage(mismatched.token)).resolves.toMatchObject({
        state: "expired",
      });
      await expect(getReportParticipant(mismatched.token)).resolves.toBeNull();
    });

    it("leaves no Meet URL or token if the delivery window already ended", async () => {
      const { schedule } = await pair();
      const old = await schedule(
        "Older meeting",
        new Date(Date.now() - 25 * hour),
      );
      await expect(
        publishSession(db, { sessionId: old.id, meetUrl }),
      ).rejects.toThrow("expiry");
      const [stored] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, old.id));
      expect(stored.meetUrl).toBeNull();
      await expect(
        db.select().from(linkTokens).where(eq(linkTokens.subjectId, old.id)),
      ).resolves.toEqual([]);
    });
  },
);
