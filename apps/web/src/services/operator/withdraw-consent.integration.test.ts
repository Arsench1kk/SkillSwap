import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db/client";
import {
  events,
  feedback,
  learnerRequests,
  matches,
  mentorBriefs,
  mentorProfiles,
  participantContacts,
  participants,
  sessions,
  skillEvidence,
} from "@/db/schema";
import {
  createParticipant,
  generateParticipantId,
} from "@/domain/participants";
import { createPrivateLink, verifyPrivateLink } from "@/domain/private-links";
import { withdrawConsentByOperator } from "./withdraw-consent";

describe.skipIf(!process.env.DATABASE_URL)(
  "operator consent withdrawal",
  () => {
    afterAll(() => pool.end());

    it("clears private data and revokes owned links once while preserving work for follow-up", async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 3_600_000);
      const operator = await createParticipant(db, { role: "operator" });
      const learner = await createParticipant(db, {
        role: "learner",
        consentGivenAt: now,
      });
      const mentor = await createParticipant(db, {
        role: "mentor",
        consentGivenAt: now,
      });
      const learnerId = learner.participantId;
      const mentorId = mentor.participantId;
      await db.insert(mentorProfiles).values({ participantId: mentorId });
      await db.insert(skillEvidence).values({
        mentorParticipantId: mentorId,
        category: "STEM",
        topic: "Spreadsheets",
        proofType: "link",
        proofReference: "https://example.test/synthetic",
      });
      const [request] = await db
        .insert(learnerRequests)
        .values({
          participantId: learnerId,
          taskCategory: "STEM",
          taskDescription: "Fix a chart.",
          triedAlready: "Refreshed the data.",
          deadlineAt: expiresAt,
          preferredWindows: [],
          status: "session_scheduled",
        })
        .returning();
      await db.insert(participantContacts).values([
        {
          participantId: learnerId,
          learnerRequestId: request.id,
          contactType: "telegram",
          value: "@synthetic_learner",
        },
        {
          participantId: mentorId,
          contactType: "telegram",
          value: "@synthetic_mentor",
        },
      ]);
      const [match] = await db
        .insert(matches)
        .values({
          requestId: request.id,
          mentorParticipantId: mentorId,
          humanDecision: "accepted",
          status: "accepted",
          learnerAcceptedAt: now,
          mentorAcceptedAt: now,
        })
        .returning();
      const [meeting] = await db
        .insert(sessions)
        .values({
          matchId: match.id,
          templateVersion: "l4-test",
          startsAt: expiresAt,
        })
        .returning();
      const [brief] = await db
        .insert(mentorBriefs)
        .values({
          requestId: request.id,
          mentorParticipantId: mentorId,
          templateVersion: "m2-test",
          sentAt: now,
          answerBy: expiresAt,
          status: "confirmed",
        })
        .returning();
      const [review] = await db
        .insert(feedback)
        .values({
          sessionId: meeting.id,
          participantId: learnerId,
          unblockedMissingReason: "incomplete",
          outcomeMissingReason: "incomplete",
          trustMissingReason: "incomplete",
          safetyMissingReason: "incomplete",
        })
        .returning();

      const learnerLinks = await Promise.all([
        createPrivateLink(db, {
          expiresAt,
          purpose: "learner_status",
          subjectType: "learner_request",
          subjectId: request.id,
        }),
        createPrivateLink(db, {
          expiresAt,
          purpose: "session",
          subjectType: "participant",
          subjectId: learnerId,
        }),
        createPrivateLink(db, {
          expiresAt,
          purpose: "session",
          subjectType: "session",
          subjectId: meeting.id,
          recipientParticipantId: learnerId,
        }),
        createPrivateLink(db, {
          expiresAt,
          purpose: "rating",
          subjectType: "feedback",
          subjectId: review.id,
        }),
      ]);
      const mentorLinks = await Promise.all([
        createPrivateLink(db, {
          expiresAt,
          purpose: "mentor_brief",
          subjectType: "mentor_brief",
          subjectId: brief.id,
        }),
        createPrivateLink(db, {
          expiresAt,
          purpose: "session",
          subjectType: "session",
          subjectId: meeting.id,
          recipientParticipantId: mentorId,
        }),
      ]);
      await expect(
        withdrawConsentByOperator(db, {
          operatorId: generateParticipantId("operator"),
          participantId: learnerId,
        }),
      ).rejects.toThrow("Active operator required");

      const withdraw = (participantId: string) =>
        withdrawConsentByOperator(db, {
          operatorId: operator.participantId,
          participantId,
        });
      const [first, second] = await Promise.all([
        withdraw(learnerId),
        withdraw(learnerId),
      ]);
      expect([first.changed, second.changed].sort()).toEqual([false, true]);
      expect(first.withdrawnAt).toEqual(second.withdrawnAt);
      expect(first.pendingRequestIds).toEqual([request.id]);
      expect(first.pendingSessionIds).toEqual([meeting.id]);
      for (const link of learnerLinks) {
        await expect(verifyPrivateLink(db, link.token)).resolves.toEqual({
          status: "revoked",
        });
      }
      for (const link of mentorLinks) {
        await expect(verifyPrivateLink(db, link.token)).resolves.toMatchObject({
          status: "valid",
        });
      }
      await expect(
        db
          .select()
          .from(participantContacts)
          .where(eq(participantContacts.participantId, learnerId)),
      ).resolves.toEqual([]);
      const relatedEvents = await db
        .select({ actor: events.actor, timestamp: events.timestampUtc })
        .from(events)
        .where(
          and(
            eq(events.participantId, learnerId),
            eq(events.eventName, "consent_withdrawn"),
          ),
        );
      expect(relatedEvents).toEqual([
        { actor: operator.participantId, timestamp: first.withdrawnAt },
      ]);

      await expect(withdraw(mentorId)).resolves.toMatchObject({
        changed: true,
        pendingSessionIds: [meeting.id],
      });
      const [evidence] = await db
        .select()
        .from(skillEvidence)
        .where(eq(skillEvidence.mentorParticipantId, mentorId));
      expect(evidence.proofReference).toBeNull();
      for (const link of mentorLinks) {
        await expect(verifyPrivateLink(db, link.token)).resolves.toEqual({
          status: "revoked",
        });
      }
      const [withdrawn] = await db
        .select()
        .from(participants)
        .where(eq(participants.participantId, mentorId));
      expect(withdrawn.status).toBe("withdrawn");
      const [stillScheduled] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, meeting.id));
      expect(stillScheduled.completionState).toBe("scheduled");
    });
  },
);
