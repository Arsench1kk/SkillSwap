import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "./client";
import {
  learnerRequests,
  linkTokens,
  mentorProfiles,
  participantContacts,
  rateLimitCounters,
  skillEvidence,
  stateTransitions,
} from "./schema";
import { recordEvent } from "@/domain/events";
import { createParticipant } from "@/domain/participants";
import {
  createPrivateLink,
  revokePrivateLink,
  verifyPrivateLink,
} from "@/domain/private-links";
import { transitionLearnerRequest } from "@/domain/state-machines";
import { allowRateLimitedAttempt } from "@/domain/rate-limit";

const databaseAvailable = Boolean(process.env.DATABASE_URL);

describe.skipIf(!databaseAvailable)("P2 PostgreSQL integration", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("stores only a SHA-256 link-token hash and verifies valid, expired, revoked, and unknown links", async () => {
    const future = new Date(Date.now() + 60_000);
    const valid = await createPrivateLink(db, {
      purpose: "learner_status",
      subjectType: "learner_request",
      subjectId: randomUUID(),
      expiresAt: future,
    });
    const [stored] = await db
      .select({ tokenHash: linkTokens.tokenHash })
      .from(linkTokens)
      .where(eq(linkTokens.id, valid.id));
    expect(stored.tokenHash).toEqual(
      createHash("sha256").update(valid.token).digest(),
    );
    expect(stored.tokenHash.toString("utf8")).not.toContain(valid.token);
    expect((await verifyPrivateLink(db, valid.token)).status).toBe("valid");

    const expired = await createPrivateLink(db, {
      purpose: "rating",
      subjectType: "session",
      subjectId: randomUUID(),
      expiresAt: future,
    });
    expect((await verifyPrivateLink(db, expired.token, future)).status).toBe(
      "expired",
    );
    await revokePrivateLink(db, valid.id);
    expect((await verifyPrivateLink(db, valid.token)).status).toBe("revoked");
    expect((await verifyPrivateLink(db, "not-a-valid-token")).status).toBe(
      "not_found",
    );
    await db.delete(linkTokens).where(eq(linkTokens.id, valid.id));
    await db.delete(linkTokens).where(eq(linkTokens.id, expired.id));
  });

  it("supports private session links whose subject is an anonymised participant id", async () => {
    const participant = await createParticipant(db, {
      role: "learner",
      consentGivenAt: new Date(),
    });
    const link = await createPrivateLink(db, {
      purpose: "session",
      subjectType: "participant",
      subjectId: participant.participantId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(verifyPrivateLink(db, link.token)).resolves.toMatchObject({
      status: "valid",
      purpose: "session",
      subjectType: "participant",
      subjectId: participant.participantId,
    });
    await db.delete(linkTokens).where(eq(linkTokens.id, link.id));
  });

  it("rejects the 11th action attempt per token within a 15-minute window", async () => {
    const value = `rate-limit-token-${randomUUID()}`;
    const now = new Date("2026-10-21T10:07:00.000Z");
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(
        allowRateLimitedAttempt(db, "mentor-brief-action", value, 10, now),
      ).resolves.toBe(true);
    }
    await expect(
      allowRateLimitedAttempt(db, "mentor-brief-action", value, 10, now),
    ).resolves.toBe(false);

    const keyHash = createHash("sha256")
      .update(`mentor-brief-action:${value}`)
      .digest("hex");
    await db
      .delete(rateLimitCounters)
      .where(eq(rateLimitCounters.keyHash, keyHash));
  });

  it("writes events through recordEvent with server-owned fields and keeps contacts separate", async () => {
    const participant = await createParticipant(db, {
      role: "learner",
      consentGivenAt: new Date(),
    });
    await db.insert(participantContacts).values({
      participantId: participant.participantId,
      contactType: "telegram",
      value: "@fake_contact_for_test",
    });
    const event = await recordEvent(
      db,
      { participantId: participant.participantId, dataOrigin: "rehearsal" },
      {
        eventName: "request_submitted",
        experiment: null,
        note: "safe test note",
      },
    );
    expect(event.participantId).toBe(participant.participantId);
    expect(event.role).toBe("learner");
    expect(event.dataOrigin).toBe("rehearsal");
    expect(event.uiLocale).toBe("en");
    expect(event.experiment).toBeNull();
    expect(JSON.stringify(event)).not.toContain("@fake_contact_for_test");
  });

  it("persists allowed state changes with actor, timestamp, source, and reason", async () => {
    const learner = await createParticipant(db, {
      role: "learner",
      consentGivenAt: new Date(),
    });
    const [request] = await db
      .insert(learnerRequests)
      .values({
        participantId: learner.participantId,
        taskCategory: "STEM",
        taskDescription: "FAKE TEST TASK",
        triedAlready: "FAKE TEST ATTEMPT",
        deadlineAt: new Date(Date.now() + 86_400_000),
        preferredWindows: [],
      })
      .returning();
    const at = new Date();
    const result = await transitionLearnerRequest(db, request.id, "submitted", {
      actor: { type: "participant", participantId: learner.participantId },
      source: "integration_test",
      reasonCode: "test_transition",
      at,
    });
    expect(result.ok).toBe(true);
    const [transition] = await db
      .select()
      .from(stateTransitions)
      .where(eq(stateTransitions.subjectId, request.id));
    expect(transition).toMatchObject({
      fromState: "draft",
      toState: "submitted",
      actorType: "participant",
      actorParticipantId: learner.participantId,
      source: "integration_test",
      reasonCode: "test_transition",
    });
    expect(transition.transitionedAt.toISOString()).toBe(at.toISOString());

    const illegal = await transitionLearnerRequest(
      db,
      request.id,
      "completed",
      {
        actor: { type: "participant", participantId: learner.participantId },
        source: "integration_test",
        reasonCode: "illegal_test_transition",
      },
    );
    expect(illegal).toMatchObject({ ok: false, error: "illegal_transition" });
  });

  it("rejects event UPDATE and DELETE in PostgreSQL", async () => {
    const client = await pool.connect();
    const id = randomUUID();
    const participantId = "L-abcdef0123";
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO participants (participant_id, role) VALUES ($1, 'learner')",
        [participantId],
      );
      await client.query(
        `INSERT INTO events (event_id, participant_id, role, event_name, data_origin)
         VALUES ($1, $2, 'learner', 'request_submitted', 'rehearsal')`,
        [id, participantId],
      );
      await client.query("SAVEPOINT before_update");
      await expect(
        client.query("UPDATE events SET note = 'changed' WHERE event_id = $1", [
          id,
        ]),
      ).rejects.toMatchObject({ code: "55000" });
      await client.query("ROLLBACK TO SAVEPOINT before_update");
      await client.query("SAVEPOINT before_delete");
      await expect(
        client.query("DELETE FROM events WHERE event_id = $1", [id]),
      ).rejects.toMatchObject({ code: "55000" });
      await client.query("ROLLBACK TO SAVEPOINT before_delete");
      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  it("does not expose contact-value columns on the events table", async () => {
    const columns = await db.execute<{ column_name: string }>(
      sql`SELECT column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'events'`,
    );
    const names = columns.rows.map((row) => row.column_name);
    expect(names).toContain("participant_id");
    expect(names).not.toContain("contact_value");
    expect(names).not.toContain("phone");
    expect(names).not.toContain("telegram");
    expect(names).not.toContain("value_contact");
  });

  it("does not allow a non-operator to change skill verification", async () => {
    const mentor = await createParticipant(db, { role: "mentor" });
    const learner = await createParticipant(db, { role: "learner" });
    const [profile] = await db
      .insert(mentorProfiles)
      .values({ participantId: mentor.participantId })
      .returning();
    const [skill] = await db
      .insert(skillEvidence)
      .values({
        mentorParticipantId: profile.participantId,
        category: "STEM",
        topic: "FAKE TEST TOPIC",
        proofType: "test",
        proofReference: "FAKE",
      })
      .returning();
    await expect(
      clientVerificationUpdate(skill.id, learner.participantId),
    ).rejects.toThrow();
  });
});

async function clientVerificationUpdate(skillId: string, actorId: string) {
  return pool.query(
    "UPDATE skill_evidence SET verification_state = 'verified', verified_at = now(), verified_by = $1 WHERE id = $2",
    [actorId, skillId],
  );
}
