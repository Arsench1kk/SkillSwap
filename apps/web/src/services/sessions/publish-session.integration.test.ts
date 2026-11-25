import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db/client";
import {
  events,
  feedback,
  learnerRequests,
  linkTokens,
  matches,
  mentorProfiles,
  sessions,
} from "@/db/schema";
import { createParticipant } from "@/domain/participants";
import { createPrivateLink, verifyPrivateLink } from "@/domain/private-links";
import { getRatingPage } from "@/domain/rating-page";
import { getReportParticipant } from "@/domain/report-page";
import { getSessionPage } from "@/domain/session-page";
import { completeSession } from "./complete-session";
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
  "operator meeting publication and completion",
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
    it("records one actual completion and one learner feedback across repeated commands", async () => {
      const { learner, schedule } = await pair();
      const operator = await createParticipant(db, { role: "operator" });
      const planned = new Date(Date.now() - hour);
      const meeting = await schedule("Review the chart", planned);
      const actualStart = new Date(planned.getTime() + 10 * 60_000);
      const actualEnd = new Date(actualStart.getTime() + 35 * 60_000);
      const input = {
        sessionId: meeting.id,
        operatorId: operator.participantId,
        actualStart,
        actualEnd,
      };
      const [first, retry] = await Promise.all([
        completeSession(db, input),
        completeSession(db, input),
      ]);
      expect(first.ratingLink).toBeTruthy();
      expect(retry.ratingLink).toBeTruthy();
      expect(first.expiresAt).toEqual(
        new Date(actualEnd.getTime() + 24 * hour),
      );
      expect(first.closesAt).toEqual(new Date(actualEnd.getTime() + 2 * hour));
      const [stored] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, meeting.id));
      expect(stored).toMatchObject({
        startsAt: planned,
        actualStartsAt: actualStart,
        endsAt: actualEnd,
        completionState: "completed",
      });
      const [request] = await db
        .select({ status: learnerRequests.status })
        .from(learnerRequests)
        .innerJoin(matches, eq(matches.requestId, learnerRequests.id))
        .where(eq(matches.id, meeting.matchId));
      expect(request.status).toBe("completed");
      const rows = await db
        .select()
        .from(feedback)
        .where(eq(feedback.sessionId, meeting.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        participantId: learner.participantId,
        unblocked: null,
        unblockedMissingReason: "incomplete",
      });
      for (const result of [first, retry]) {
        if (!result.ratingLink) throw new Error("Rating link missing");
        await expect(
          getRatingPage(result.ratingLink.token),
        ).resolves.toMatchObject({ state: "form", feedbackId: rows[0].id });
        await expect(
          verifyPrivateLink(db, result.ratingLink.token, result.closesAt),
        ).resolves.toMatchObject({ status: "valid" });
        await expect(
          verifyPrivateLink(db, result.ratingLink.token, result.expiresAt),
        ).resolves.toEqual({ status: "expired" });
      }
      const log = await db
        .select()
        .from(events)
        .where(eq(events.participantId, learner.participantId));
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({
        eventName: "session_completed",
        value: 35,
        actor: operator.participantId,
        timestampUtc: actualEnd,
        templateVersion: "l4-v1",
      });
      await expect(
        completeSession(db, { ...input, actualStart: planned }),
      ).rejects.toThrow("already completed");
    });

    it("requires an active operator and refuses to complete a cancelled meeting", async () => {
      const { schedule } = await pair();
      const operator = await createParticipant(db, { role: "operator" });
      const now = Date.now();
      const meeting = await schedule("Check the plan", new Date(now - hour));
      const args = {
        sessionId: meeting.id,
        operatorId: operator.participantId,
        actualStart: new Date(now - hour),
        actualEnd: new Date(now - 30 * 60_000),
      };
      await expect(
        completeSession(db, { ...args, operatorId: "O-0000000000" }),
      ).rejects.toThrow("Active operator required");
      await expect(
        completeSession(db, { ...args, actualEnd: new Date(now + hour) }),
      ).rejects.toThrow("already elapsed");
      await db
        .update(sessions)
        .set({ completionState: "cancelled" })
        .where(eq(sessions.id, meeting.id));
      await expect(completeSession(db, args)).rejects.toThrow(
        "Meeting unavailable",
      );
      await expect(
        db.select().from(feedback).where(eq(feedback.sessionId, meeting.id)),
      ).resolves.toEqual([]);
    });

    it("records a late completion without opening a new feedback window", async () => {
      const { schedule } = await pair();
      const operator = await createParticipant(db, { role: "operator" });
      const actualStart = new Date(Date.now() - 4 * hour);
      const actualEnd = new Date(actualStart.getTime() + 45 * 60_000);
      const meeting = await schedule("Earlier meeting", actualStart);
      await expect(
        completeSession(db, {
          sessionId: meeting.id,
          operatorId: operator.participantId,
          actualStart,
          actualEnd,
        }),
      ).resolves.toEqual({
        ratingLink: null,
        reason: "window_closed",
      });
      const [stored] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, meeting.id));
      expect(stored.completionState).toBe("completed");
      await expect(
        db.select().from(feedback).where(eq(feedback.sessionId, meeting.id)),
      ).resolves.toEqual([]);
    });
  },
);
