import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { POST as joinMentor } from "../../app/api/mentor/join/route";
import { db, pool } from "@/db/client";
import { events, learnerRequests, skillEvidence } from "@/db/schema";
import { listVerifiedSkills } from "../services/operator/matching-queue";
import {
  getPendingSkillProof,
  listPendingSkillEvidence,
} from "../services/operator/verification-queue";
import { createParticipant, withdrawParticipantConsent } from "./participants";
import { setSkillVerification } from "./skill-verification";
import { toKazakhstanDateTimeInput } from "./time";

const HOUR = 3_600_000;
const proofReference = "https://example.test/synthetic";

async function submitSkill() {
  const now = Date.now();
  const topic = `Synthetic spreadsheet skill ${randomUUID()}`;
  const response = await joinMentor(
    new Request("http://localhost/api/mentor/join", {
      method: "POST",
      body: JSON.stringify({
        displayName: "Synthetic Mentor",
        category: "STEM",
        topic,
        proofType: "link",
        proofReference,
        availability: [2, 4].map((offset) => ({
          start: toKazakhstanDateTimeInput(new Date(now + offset * HOUR)),
          end: toKazakhstanDateTimeInput(new Date(now + (offset + 1) * HOUR)),
        })),
        contactType: "telegram",
        contact: "@synthetic_mentor",
        consent: true,
      }),
    }),
  );
  expect(response.status).toBe(201);
  const [evidence] = await db
    .select()
    .from(skillEvidence)
    .where(eq(skillEvidence.topic, topic));
  expect(evidence.verificationState).toBe("pending");
  return evidence;
}

describe.skipIf(!process.env.DATABASE_URL)(
  "operator skill verification",
  () => {
    afterAll(() => pool.end());

    it("turns a submitted skill into a matching candidate with a single private audit event", async () => {
      const evidence = await submitSkill();
      const operator = await createParticipant(db, { role: "operator" });
      const learner = await createParticipant(db, { role: "learner" });
      const [request] = await db
        .insert(learnerRequests)
        .values({
          participantId: learner.participantId,
          taskCategory: "STEM",
          taskDescription: "My chart no longer updates.",
          triedAlready: "I refreshed the source data.",
          deadlineAt: new Date(Date.now() + 24 * HOUR),
          preferredWindows: [],
          status: "eligible",
        })
        .returning({ id: learnerRequests.id });

      const queue = await listPendingSkillEvidence(db, operator.participantId);
      expect(queue.find((row) => row.skillId === evidence.id)).toEqual({
        skillId: evidence.id,
        category: "STEM",
        topic: evidence.topic,
        submittedAt: evidence.createdAt,
      });
      await expect(
        getPendingSkillProof(db, operator.participantId, evidence.id),
      ).resolves.toEqual({
        skillId: evidence.id,
        mentorId: evidence.mentorParticipantId,
        category: "STEM",
        topic: evidence.topic,
        proofType: "link",
        proofReference,
      });
      const skills = () =>
        listVerifiedSkills(db, operator.participantId, request.id);
      expect((await skills()).some((row) => row.skillId === evidence.id)).toBe(
        false,
      );
      const input = {
        operatorParticipantId: operator.participantId,
        skillEvidenceId: evidence.id,
        state: "verified" as const,
      };
      const decisions = await Promise.all([
        setSkillVerification(db, input),
        setSkillVerification(db, input),
      ]);
      expect(decisions.filter(Boolean)).toHaveLength(1);
      expect(decisions.find(Boolean)).toEqual({
        skillId: evidence.id,
        state: "verified",
        decidedAt: expect.any(Date),
      });

      expect(
        (await listPendingSkillEvidence(db, operator.participantId)).some(
          (row) => row.skillId === evidence.id,
        ),
      ).toBe(false);
      expect(
        (await skills()).find((row) => row.skillId === evidence.id),
      ).toEqual({
        skillId: evidence.id,
        mentorId: evidence.mentorParticipantId,
        topic: evidence.topic,
      });
      const audit = await db
        .select()
        .from(events)
        .where(
          and(
            eq(events.participantId, evidence.mentorParticipantId),
            eq(events.eventName, "skill_verification_decided"),
          ),
        );
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        role: "mentor",
        actor: operator.participantId,
        reasonCode: "verified",
        timestampUtc: decisions.find(Boolean)?.decidedAt,
        note: null,
      });
      expect(JSON.stringify(audit[0])).not.toContain(proofReference);
    });

    it("refuses withdrawn and mentor access, and records a rejection separately", async () => {
      const evidence = await submitSkill();
      const active = await createParticipant(db, { role: "operator" });
      const withdrawn = await createParticipant(db, {
        role: "operator",
        consentGivenAt: new Date(),
      });
      await withdrawParticipantConsent(db, withdrawn.participantId);

      await expect(
        listPendingSkillEvidence(db, withdrawn.participantId),
      ).rejects.toThrow("Active operator required");
      await expect(
        getPendingSkillProof(db, withdrawn.participantId, evidence.id),
      ).rejects.toThrow("Active operator required");
      await expect(
        getPendingSkillProof(db, evidence.mentorParticipantId, evidence.id),
      ).rejects.toThrow();
      await expect(
        setSkillVerification(db, {
          operatorParticipantId: withdrawn.participantId,
          skillEvidenceId: evidence.id,
          state: "verified",
        }),
      ).rejects.toThrow("Active operator required");
      const [stored] = await db
        .select()
        .from(skillEvidence)
        .where(eq(skillEvidence.id, evidence.id));
      expect(stored).toMatchObject({
        verificationState: "pending",
        verifiedBy: null,
        verifiedAt: null,
      });

      await expect(
        setSkillVerification(db, {
          operatorParticipantId: active.participantId,
          skillEvidenceId: evidence.id,
          state: "rejected",
        }),
      ).resolves.toMatchObject({ state: "rejected" });
      await expect(
        getPendingSkillProof(db, active.participantId, evidence.id),
      ).resolves.toBeNull();
      const audit = await db
        .select({ reasonCode: events.reasonCode })
        .from(events)
        .where(
          and(
            eq(events.participantId, evidence.mentorParticipantId),
            eq(events.eventName, "skill_verification_decided"),
          ),
        );
      expect(audit).toEqual([{ reasonCode: "rejected" }]);
    });
  },
);
