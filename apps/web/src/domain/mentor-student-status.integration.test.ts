import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { db, pool } from "@/db/client";
import {
  events,
  learnerRequests,
  mentorProfiles,
  skillEvidence,
} from "@/db/schema";
import { issueFirstBrief } from "../services/mentor/issue-first-brief";
import { listVerifiedSkills } from "../services/operator/matching-queue";
import { listPendingStudentVerifications } from "../services/operator/verification-queue";
import { setMentorStudentStatus } from "./mentor-student-status";
import { createParticipant, withdrawParticipantConsent } from "./participants";

const HOUR = 3_600_000;

describe.skipIf(!process.env.DATABASE_URL)("mentor student status", () => {
  afterEach(() => vi.unstubAllEnvs());
  afterAll(() => pool.end());

  it("requires operator-confirmed student status for real-pilot listing and invitation", async () => {
    const now = Date.now();
    const owner = await createParticipant(db, { role: "operator" });
    const withdrawn = await createParticipant(db, {
      role: "operator",
      consentGivenAt: new Date(now),
    });
    await withdrawParticipantConsent(db, withdrawn.participantId);
    const learner = await createParticipant(db, { role: "learner" });
    const mentor = await createParticipant(db, { role: "mentor" });
    await db
      .insert(mentorProfiles)
      .values({ participantId: mentor.participantId });
    const [skill] = await db
      .insert(skillEvidence)
      .values({
        mentorParticipantId: mentor.participantId,
        category: "STEM",
        topic: "Spreadsheets",
        proofType: "link",
        proofReference: "https://example.test/project",
        verificationState: "verified",
        verifiedAt: new Date(now),
        verifiedBy: owner.participantId,
      })
      .returning({ id: skillEvidence.id });
    const [request] = await db
      .insert(learnerRequests)
      .values({
        participantId: learner.participantId,
        taskCategory: "STEM",
        taskDescription: "Fix a chart that does not update.",
        triedAlready: "Refreshed the data.",
        status: "eligible",
        deadlineAt: new Date(now + 8 * HOUR),
        preferredWindows: [
          {
            startUtc: new Date(now + 2 * HOUR).toISOString(),
            endUtc: new Date(now + 3 * HOUR).toISOString(),
          },
        ],
      })
      .returning({ id: learnerRequests.id });
    const input = {
      operatorId: owner.participantId,
      mentorId: mentor.participantId,
    };
    const invite = {
      operatorId: input.operatorId,
      skillId: skill.id,
      requestId: request.id,
      reason: "The skill matches the request.",
    };
    const candidateIsListed = async () =>
      (await listVerifiedSkills(db, input.operatorId, invite.requestId)).some(
        (row) => row.skillId === skill.id,
      );

    vi.stubEnv("SKILLSWAP_DATA_ORIGIN", "rehearsal");
    expect(await candidateIsListed()).toBe(true);

    vi.stubEnv("SKILLSWAP_DATA_ORIGIN", "real_pilot");
    expect(await candidateIsListed()).toBe(false);
    await expect(issueFirstBrief(db, invite)).rejects.toThrow(
      "Verified mentor skill unavailable",
    );
    const pending = await listPendingStudentVerifications(db, input.operatorId);
    expect(pending).toContainEqual({ mentorId: input.mentorId });
    await expect(
      setMentorStudentStatus(db, {
        ...input,
        operatorId: withdrawn.participantId,
        state: "verified",
      }),
    ).rejects.toThrow("Active operator required");
    await setMentorStudentStatus(db, { ...input, state: "rejected" });
    expect(await candidateIsListed()).toBe(false);

    await setMentorStudentStatus(db, { ...input, state: "verified" });
    await expect(
      setMentorStudentStatus(db, { ...input, state: "verified" }),
    ).resolves.toBeNull();
    expect(await candidateIsListed()).toBe(true);
    await expect(issueFirstBrief(db, invite)).resolves.toHaveProperty("link");

    const audit = await db
      .select({
        reason: events.reasonCode,
        actor: events.actor,
        note: events.note,
      })
      .from(events)
      .where(
        and(
          eq(events.participantId, input.mentorId),
          eq(events.eventName, "mentor_student_status_decided"),
        ),
      );
    expect(audit).toHaveLength(2);
    expect(audit).toEqual(
      expect.arrayContaining([
        { reason: "rejected", actor: input.operatorId, note: null },
        { reason: "verified", actor: input.operatorId, note: null },
      ]),
    );
  });
});
