import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { POST as respondToBrief } from "../../../app/api/brief/action/route";
import { POST as respondToProposal } from "../../../app/api/request/status/route";
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
import { issueMentorBrief } from "../mentor/issue-mentor-brief";
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

async function anotherSkill(operatorId: string) {
  const mentor = await createParticipant(db, { role: "mentor" });
  await db.insert(mentorProfiles).values({
    participantId: mentor.participantId,
    displayName: "Other Mentor Test",
  });
  const [skill] = await db
    .insert(skillEvidence)
    .values({
      mentorParticipantId: mentor.participantId,
      category: "STEM",
      topic: "Spreadsheets",
      proofType: "fixture",
      verificationState: "verified",
      verifiedBy: operatorId,
      verifiedAt: new Date(),
    })
    .returning();
  return skill.id;
}

async function setPastAnswerBy(briefId: string) {
  await db
    .update(mentorBriefs)
    .set({
      sentAt: new Date(Date.now() - 49 * HOUR),
      answerBy: new Date(Date.now() - HOUR),
    })
    .where(eq(mentorBriefs.id, briefId));
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
        issueMentorBrief(db, { ...input, skillId: pending.id }),
      ).rejects.toThrow("Verified mentor skill unavailable");

      const attempts = await Promise.allSettled([
        issueMentorBrief(db, input),
        issueMentorBrief(db, input),
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

    it("expires an unanswered invitation once and leaves a proposed time alone", async () => {
      const { input, request, mentor } = await createFixture(24);
      const responded = await createFixture(24);
      const unanswered = await issueMentorBrief(db, input);
      const proposed = await issueMentorBrief(db, responded.input);
      expect((await propose(proposed.link.token)).status).toBe(200);
      await setPastAnswerBy(unanswered.briefId);
      await setPastAnswerBy(proposed.briefId);

      const [first, second] = await Promise.all([
        listUnassignedRequests(db, input.operatorId),
        listUnassignedRequests(db, input.operatorId),
      ]);
      const ids = [...first, ...second].map((row) => row.id);
      expect(ids).toContain(request.id);
      expect(ids).not.toContain(responded.request.id);
      const [oldBrief] = await db
        .select()
        .from(mentorBriefs)
        .where(eq(mentorBriefs.id, unanswered.briefId));
      expect(oldBrief.status).toBe("no_reply");
      const [proposal] = await db
        .select()
        .from(mentorBriefs)
        .where(eq(mentorBriefs.id, proposed.briefId));
      expect(proposal.status).toBe("slot_proposed");
      const log = await db
        .select()
        .from(events)
        .where(
          and(
            eq(events.participantId, mentor.participantId),
            eq(events.eventName, "mentor_no_reply"),
          ),
        );
      expect(log).toMatchObject([
        { templateVersion: "m2-v1", missingReason: "no_reply" },
      ]);
      await expect(
        verifyPrivateLink(db, unanswered.link.token),
      ).resolves.toEqual({
        status: "revoked",
      });
      const other = await anotherSkill(input.operatorId);
      const replacement = await issueMentorBrief(db, {
        ...input,
        skillId: other,
      });
      expect(replacement.briefId).not.toBe(unanswered.briefId);
    });

    it.each(["decline", "withdraw"] as const)(
      "replaces a %s with another verified mentor and rejects stale learner actions",
      async (action) => {
        const { input, request } = await createFixture(24);
        const statusLink = await createPrivateLink(db, {
          purpose: "learner_status",
          subjectType: "learner_request",
          subjectId: request.id,
          expiresAt: request.deadlineAt,
        });
        const first = await issueMentorBrief(db, input);
        expect((await propose(first.link.token)).status).toBe(200);
        const old = await getLearnerStatusPage(statusLink.token);
        expect(old.proposal).toBeDefined();
        const response = await respondToBrief(
          new Request("http://localhost/api/brief/action", {
            method: "POST",
            body: JSON.stringify({
              action,
              token: first.link.token,
              reasonCode: "not_my_skill",
            }),
          }),
        );
        expect(response.status).toBe(200);
        expect(
          (await listUnassignedRequests(db, input.operatorId)).some(
            (row) => row.id === request.id,
          ),
        ).toBe(true);
        expect(
          (await listVerifiedSkills(db, input.operatorId, request.id)).some(
            (row) => row.skillId === input.skillId,
          ),
        ).toBe(false);
        await expect(issueMentorBrief(db, input)).rejects.toThrow(
          "Verified mentor skill unavailable",
        );
        const next = {
          ...input,
          skillId: await anotherSkill(input.operatorId),
        };
        const attempts = await Promise.allSettled([
          issueMentorBrief(db, next),
          issueMentorBrief(db, next),
        ]);
        const issued = attempts.flatMap((attempt) =>
          attempt.status === "fulfilled" ? [attempt.value] : [],
        );
        expect(issued).toHaveLength(1);
        expect((await propose(first.link.token)).status).toBe(410);
        expect((await propose(issued[0].link.token)).status).toBe(200);
        const current = await getLearnerStatusPage(statusLink.token);
        expect(current.proposal?.matchId).not.toBe(old.proposal?.matchId);

        const confirm = (proposal?: typeof current.proposal) =>
          respondToProposal(
            new Request("http://localhost/api/request/status", {
              method: "POST",
              body: JSON.stringify({
                action: "confirm",
                token: statusLink.token,
                proposal,
              }),
            }),
          );
        expect((await confirm(old.proposal)).status).toBe(409);
        expect((await confirm()).status).toBe(409);
        expect((await confirm(current.proposal)).status).toBe(200);
        const stored = await db
          .select({ matchId: sessions.matchId })
          .from(sessions)
          .innerJoin(matches, eq(matches.id, sessions.matchId))
          .where(eq(matches.requestId, request.id));
        expect(stored).toEqual([{ matchId: current.proposal?.matchId }]);
      },
    );

    it("caps a long deadline at 48 hours and respects a subsequently shortened deadline", async () => {
      const { input, request } = await createFixture(72);
      const { link, answerBy } = await issueMentorBrief(db, input);
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
