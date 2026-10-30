import { eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import {
  learnerRequests,
  mentorProfiles,
  participantContacts,
  participants,
  skillEvidence,
} from "@/db/schema";
import { recordEvent } from "@/domain/events";
import { transitionLearnerRequest } from "@/domain/state-machines";

async function seed() {
  const now = new Date();
  const addHours = (hours: number) =>
    new Date(now.getTime() + hours * 3_600_000);
  const addDays = (days: number) => new Date(now.getTime() + days * 86_400_000);
  const learnerId = "L-0000000001";
  const mentorId = "M-0000000002";

  await db
    .insert(participants)
    .values([
      {
        participantId: learnerId,
        role: "learner",
        consentGivenAt: now,
        campus: "Fake campus (rehearsal)",
      },
      {
        participantId: mentorId,
        role: "mentor",
        consentGivenAt: now,
        campus: "Fake campus (rehearsal)",
        yearOfStudy: 3,
      },
    ])
    .onConflictDoNothing();

  const [existingContact] = await db
    .select({ id: participantContacts.id })
    .from(participantContacts)
    .where(eq(participantContacts.participantId, learnerId))
    .limit(1);
  if (!existingContact) {
    await db.insert(participantContacts).values({
      participantId: learnerId,
      contactType: "telegram",
      value: "@fake_learner_rehearsal",
    });
  }

  await db
    .insert(mentorProfiles)
    .values({
      participantId: mentorId,
      displayName: "FAKE REHEARSAL MENTOR",
      experienceStatement: "Fake rehearsal profile; not a real mentor.",
      availabilityWindows: [
        {
          startUtc: addHours(48).toISOString(),
          endUtc: addHours(50).toISOString(),
        },
      ],
    })
    .onConflictDoNothing();

  const [existingRequest] = await db
    .select({ id: learnerRequests.id })
    .from(learnerRequests)
    .where(eq(learnerRequests.participantId, learnerId))
    .limit(1);

  if (!existingRequest) {
    const [request] = await db
      .insert(learnerRequests)
      .values({
        participantId: learnerId,
        taskCategory: "STEM",
        taskDescription:
          "FAKE REHEARSAL TASK: explain a sample calculus exercise.",
        triedAlready: "FAKE REHEARSAL: read a sample textbook chapter.",
        deadlineAt: addDays(7),
        preferredWindows: [
          {
            startUtc: addHours(48).toISOString(),
            endUtc: addHours(49).toISOString(),
          },
        ],
      })
      .returning();

    await transitionLearnerRequest(db, request.id, "submitted", {
      actor: { type: "participant", participantId: learnerId },
      source: "seed",
      reasonCode: "rehearsal_seed",
      at: now,
    });
    await recordEvent(
      db,
      { participantId: learnerId, dataOrigin: "rehearsal" },
      {
        eventName: "request_submitted",
        taskCategory: "STEM",
        sourceChannel: "rehearsal_seed",
        timestampUtc: now,
        note: "FAKE REHEARSAL DATA ONLY",
      },
    );
  }

  const [existingSkill] = await db
    .select({ id: skillEvidence.id })
    .from(skillEvidence)
    .where(eq(skillEvidence.mentorParticipantId, mentorId))
    .limit(1);
  if (!existingSkill) {
    await db.insert(skillEvidence).values({
      mentorParticipantId: mentorId,
      category: "STEM",
      topic: "FAKE REHEARSAL: sample calculus",
      proofType: "rehearsal_fixture",
      proofReference: "FAKE - no real proof supplied",
    });
  }

  console.info("Inserted only clearly fake rehearsal fixtures.");
}

seed()
  .catch((error: unknown) => {
    console.error(
      "Rehearsal seed failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
