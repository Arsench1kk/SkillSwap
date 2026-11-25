import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { POST as respondToBrief } from "../../../app/api/brief/action/route";
import { db, pool } from "@/db/client";
import {
  events,
  learnerRequests,
  matches,
  mentorBriefs,
  mentorProfiles,
  sessions,
  skillEvidence,
} from "@/db/schema";
import { getLearnerStatusPage } from "@/domain/learner-status";
import { getMentorBriefPage } from "@/domain/mentor-brief-page";
import { createParticipant } from "@/domain/participants";
import { createPrivateLink, verifyPrivateLink } from "@/domain/private-links";
import { confirmLearnerMatch } from "../learner/request-actions";
import { issueFirstBrief } from "../mentor/issue-first-brief";
import { listUnassignedRequests, listVerifiedSkills } from "./matching-queue";

const HOUR = 3_600_000;

async function createFixture(deadlineHours: number) {
  const now = new Date();
  const slot = new Date(now.getTime() + 3 * HOUR);
  const operator = await createParticipant(db, {
    role: "operator",
    consentGivenAt: now,
  });
  const learner = await createParticipant(db, {
    role: "learner",
    consentGivenAt: now,
  });
  const mentor = await createParticipant(db, {
    role: "mentor",
    consentGivenAt: now,
    yearOfStudy: 3,
  });
  await db.insert(mentorProfiles).values({
    participantId: mentor.participantId,
    displayName: "Mentor Test",
  });
  const evidence = {
    mentorParticipantId: mentor.participantId,
    category: "STEM" as const,
    topic: "Spreadsheets",
    proofType: "fixture",
    proofReference: "synthetic-evidence",
  };
  const [verified, pending] = await db
    .insert(skillEvidence)
    .values([
      {
        ...evidence,
        verificationState: "verified",
        verifiedBy: operator.participantId,
        verifiedAt: now,
      },
      evidence,
    ])
    .returning();
  const [request] = await db
    .insert(learnerRequests)
    .values({
      participantId: learner.participantId,
      taskCategory: "STEM",
      taskDescription: "Fix a chart that does not update.",
      triedAlready: "Refreshed the data.",
      deadlineAt: new Date(now.getTime() + deadlineHours * HOUR),
      preferredWindows: [
        {
          startUtc: slot.toISOString(),
          endUtc: new Date(slot.getTime() + HOUR).toISOString(),
        },
      ],
      status: "eligible",
    })
    .returning();
  return {
    input: {
      operatorId: operator.participantId,
      requestId: request.id,
      skillId: verified.id,
      reason: "Verified spreadsheet skill fits the task.",
    },
    request,
    slot,
    pending,
    mentor,
  };
}

function propose(token: string) {
  return respondToBrief(
    new Request("http://localhost/api/brief/action", {
      method: "POST",
      body: JSON.stringify({ action: "propose", token, windowIndex: "0" }),
    }),
  );
}

describe.skipIf(!process.env.DATABASE_URL)(
  "operator's first invitation",
  () => {
    afterAll(() => pool.end());

    it("issues one scoped invitation and connects the proposal to learner confirmation", async () => {
      const { input, request, slot, pending, mentor } = await createFixture(24);
      const statusLink = await createPrivateLink(db, {
        purpose: "learner_status",
        subjectType: "learner_request",
        subjectId: request.id,
        expiresAt: request.deadlineAt,
      });

      const queue = await listUnassignedRequests(db, input.operatorId);
      expect(queue.some((row) => row.id === request.id)).toBe(true);
      const skills = await listVerifiedSkills(db, input.operatorId, request.id);
      expect(
        skills.filter((skill) => skill.mentorId === mentor.participantId),
      ).toEqual([
        {
          skillId: input.skillId,
          mentorId: mentor.participantId,
          topic: "Spreadsheets",
        },
      ]);
      await expect(listUnassignedRequests(db, "O-0000000000")).rejects.toThrow(
        "Active operator required",
      );
      await expect(
        issueFirstBrief(db, { ...input, skillId: pending.id }),
      ).rejects.toThrow("Verified mentor skill unavailable");

      const attempts = await Promise.allSettled([
        issueFirstBrief(db, input),
        issueFirstBrief(db, input),
      ]);
      const issued = attempts.flatMap((attempt) =>
        attempt.status === "fulfilled" ? [attempt.value] : [],
      );
      expect(issued).toHaveLength(1);
      const [{ link, answerBy }] = issued;
      expect(answerBy).toEqual(request.deadlineAt);
      await expect(
        verifyPrivateLink(db, link.token, answerBy),
      ).resolves.toEqual({
        status: "expired",
      });
      expect(
        (await listUnassignedRequests(db, input.operatorId)).some(
          (row) => row.id === request.id,
        ),
      ).toBe(false);
      expect(
        (
          await db
            .select()
            .from(events)
            .where(
              and(
                eq(events.participantId, mentor.participantId),
                eq(events.eventName, "brief_sent"),
              ),
            )
        ).map(({ actor, templateVersion }) => ({
          actor,
          templateVersion,
        })),
      ).toEqual([{ actor: input.operatorId, templateVersion: "m2-v1" }]);
      expect((await getLearnerStatusPage(statusLink.token)).state).toBe(
        "waiting",
      );
      expect((await getMentorBriefPage(link.token)).state).toBe("unanswered");

      expect((await propose(link.token)).status).toBe(200);
      expect((await getLearnerStatusPage(statusLink.token)).state).toBe(
        "matched",
      );
      await expect(
        confirmLearnerMatch(db, {
          requestId: request.id,
          dataOrigin: "rehearsal",
        }),
      ).resolves.toEqual({ ok: true });
      const storedSessions = await db
        .select({ startsAt: sessions.startsAt })
        .from(sessions)
        .innerJoin(matches, eq(sessions.matchId, matches.id))
        .where(eq(matches.requestId, request.id));
      expect(storedSessions).toEqual([{ startsAt: slot }]);
    });

    it("caps a long deadline at 48 hours and respects a subsequently shortened deadline", async () => {
      const { input, request } = await createFixture(72);
      const { link, answerBy } = await issueFirstBrief(db, input);
      const [brief] = await db
        .select({ sentAt: mentorBriefs.sentAt })
        .from(mentorBriefs)
        .where(eq(mentorBriefs.requestId, request.id));
      expect(answerBy.getTime() - brief.sentAt.getTime()).toBe(48 * HOUR);
      await db
        .update(learnerRequests)
        .set({ deadlineAt: new Date(Date.now() - 1000) })
        .where(eq(learnerRequests.id, request.id));

      expect((await getMentorBriefPage(link.token)).state).toBe("expired");
      expect((await propose(link.token)).status).toBe(409);
    });
  },
);
