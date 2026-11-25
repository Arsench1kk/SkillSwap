import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db/client";
import { mentorProfiles, skillEvidence } from "@/db/schema";
import {
  getPendingSkillProof,
  listPendingSkillEvidence,
} from "../services/operator/verification-queue";
import { createParticipant, withdrawParticipantConsent } from "./participants";
import { purgeExpiredSkillProof } from "./skill-proof-retention";
import { setSkillVerification } from "./skill-verification";

const DAY = 86_400_000;

describe.skipIf(!process.env.DATABASE_URL)(
  "mentor skill proof retention",
  () => {
    afterAll(() => pool.end());

    it("hides expired proof, purges the reference, and preserves verification metadata", async () => {
      const now = new Date();
      const operator = await createParticipant(db, { role: "operator" });
      const mentor = await createParticipant(db, {
        role: "mentor",
        consentGivenAt: now,
      });
      await db
        .insert(mentorProfiles)
        .values({ participantId: mentor.participantId });
      const proof = {
        mentorParticipantId: mentor.participantId,
        category: "STEM" as const,
        topic: "Spreadsheets",
        proofType: "link",
        proofReference: "https://example.test/synthetic",
      };
      const cutoff = new Date(now.getTime() - 30 * DAY);
      const [pending, verified, recent] = await db
        .insert(skillEvidence)
        .values([
          { ...proof, createdAt: cutoff },
          {
            ...proof,
            createdAt: cutoff,
            verificationState: "verified",
            verifiedAt: new Date(now.getTime() - 29 * DAY),
            verifiedBy: operator.participantId,
          },
          { ...proof, createdAt: now },
        ])
        .returning();

      const queue = await listPendingSkillEvidence(db, operator.participantId);
      expect(queue.some(({ skillId }) => skillId === pending.id)).toBe(false);
      expect(queue.some(({ skillId }) => skillId === recent.id)).toBe(true);
      await expect(
        getPendingSkillProof(db, operator.participantId, pending.id),
      ).resolves.toBeNull();
      await expect(
        setSkillVerification(db, {
          skillEvidenceId: pending.id,
          operatorParticipantId: operator.participantId,
          state: "verified",
        }),
      ).resolves.toBeNull();

      await expect(purgeExpiredSkillProof(db, now)).resolves.toBe(2);
      await expect(purgeExpiredSkillProof(db, now)).resolves.toBe(0);
      const [stored] = await db
        .select()
        .from(skillEvidence)
        .where(eq(skillEvidence.id, verified.id));
      expect(stored).toEqual({ ...verified, proofReference: null });
      await expect(
        getPendingSkillProof(db, operator.participantId, recent.id),
      ).resolves.toMatchObject({ proofReference: proof.proofReference });

      await withdrawParticipantConsent(db, mentor.participantId);
      const [afterWithdrawal] = await db
        .select()
        .from(skillEvidence)
        .where(eq(skillEvidence.id, recent.id));
      expect(afterWithdrawal).toEqual({ ...recent, proofReference: null });
    });
  },
);
