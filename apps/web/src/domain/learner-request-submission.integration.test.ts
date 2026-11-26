import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db/client";
import {
  accountParticipants,
  authUsers,
  events,
  learnerRequests,
  matches,
  mentorProfiles,
  participantContacts,
} from "@/db/schema";
import { getLearnerStatusPage } from "./learner-status";
import { createParticipant } from "./participants";
import { verifyPrivateLink } from "./private-links";
import {
  submitLearnerRequest,
  type LearnerRequestInput,
} from "./learner-request-submission";
import { toKazakhstanDateInput } from "./time";

// Writes to the database named by DATABASE_URL; use a disposable one.
const databaseAvailable = Boolean(process.env.DATABASE_URL);
const DAY = 86_400_000;

const local = (days: number, hour: number) =>
  `${toKazakhstanDateInput(new Date(Date.now() + days * DAY))}T${String(hour).padStart(2, "0")}:00`;

function input(
  overrides: Partial<LearnerRequestInput> = {},
): LearnerRequestInput {
  const suffix = randomUUID().slice(0, 8).replace(/-/g, "");
  const base: LearnerRequestInput = {
    category: "STEM",
    task: "My chart does not update.",
    tried: "Refreshed the data.",
    deadline: toKazakhstanDateInput(new Date(Date.now() + 7 * DAY)),
    windows: [
      { start: local(2, 10), end: local(2, 11) },
      { start: local(3, 10), end: local(3, 11) },
    ],
    giveBack: "",
    contactType: "telegram",
    contact: `@learner_${suffix}`,
    consent: true,
  };
  return { ...base, ...overrides } as LearnerRequestInput;
}

async function eventsOf(participantId: string) {
  return db
    .select()
    .from(events)
    .where(eq(events.participantId, participantId));
}

async function requestRow(requestId: string) {
  const [row] = await db
    .select()
    .from(learnerRequests)
    .where(eq(learnerRequests.id, requestId));
  return row;
}

async function proposeMatch(requestId: string) {
  const mentor = await createParticipant(db, { role: "mentor" });
  await db
    .insert(mentorProfiles)
    .values({ participantId: mentor.participantId });
  await db
    .update(learnerRequests)
    .set({ status: "matched" })
    .where(eq(learnerRequests.id, requestId));
  const [match] = await db
    .insert(matches)
    .values({
      requestId,
      mentorParticipantId: mentor.participantId,
      humanDecision: "accepted",
      status: "proposed",
      mentorAcceptedAt: new Date(),
      proposedSlotAt: new Date(Date.now() + DAY),
    })
    .returning({ id: matches.id });
  return async () => {
    await db
      .update(matches)
      .set({ status: "accepted", learnerAcceptedAt: new Date() })
      .where(eq(matches.id, match.id));
    await db
      .update(learnerRequests)
      .set({ status: "session_scheduled" })
      .where(eq(learnerRequests.id, requestId));
  };
}

describe.skipIf(!databaseAvailable)("submitLearnerRequest", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("stores an eligible guest request with a private status link and no contact in events", async () => {
    const data = input();
    const result = await submitLearnerRequest(data);
    if (result.status !== "eligible") throw new Error("expected eligible");

    const row = await requestRow(result.requestId);
    expect(row.status).toBe("eligible");
    expect(row.preferredWindows).toHaveLength(2);
    await expect(verifyPrivateLink(db, result.token)).resolves.toMatchObject({
      status: "valid",
      purpose: "learner_status",
      subjectId: result.requestId,
    });

    const contacts = await db
      .select()
      .from(participantContacts)
      .where(eq(participantContacts.participantId, row.participantId));
    expect(contacts.map((c) => c.value)).toEqual([data.contact]);

    const eventRows = await eventsOf(row.participantId);
    expect(eventRows.map((e) => e.eventName).sort()).toEqual([
      "eligibility_checked",
      "request_submitted",
    ]);
    expect(eventRows.every((e) => e.dataOrigin === "rehearsal")).toBe(true);
    expect(JSON.stringify(eventRows)).not.toContain(data.contact);
  });

  it("records an ineligible request when the deadline is more than 14 days away", async () => {
    const result = await submitLearnerRequest(
      input({
        deadline: toKazakhstanDateInput(new Date(Date.now() + 30 * DAY)),
      }),
    );
    expect(result).toMatchObject({ status: "ineligible", reason: "deadline" });
    const requestId = "requestId" in result ? result.requestId : undefined;
    if (!requestId) throw new Error("expected a stored ineligible request");

    const row = await requestRow(requestId);
    expect(row.status).toBe("ineligible");
    const eligibility = (await eventsOf(row.participantId)).find(
      (e) => e.eventName === "eligibility_checked",
    );
    expect(eligibility?.reasonCode).toBe("deadline_outside_14_days");
  });

  it("does not store a request for an unsupported task area, but records the eligibility check", async () => {
    const data = input({ category: "other" });
    const result = await submitLearnerRequest(data);
    expect(result).toEqual({ status: "ineligible", reason: "category" });

    const [contact] = await db
      .select()
      .from(participantContacts)
      .where(eq(participantContacts.value, data.contact));
    const eventRows = await eventsOf(contact.participantId);
    expect(
      eventRows.find((e) => e.eventName === "eligibility_checked")?.reasonCode,
    ).toBe("unsupported_category");
    const requests = await db
      .select()
      .from(learnerRequests)
      .where(eq(learnerRequests.participantId, contact.participantId));
    expect(requests).toHaveLength(0);
  });

  it("rejects windows in the past or reversed, and bad contacts, without writing anything", async () => {
    const bad = [
      input({
        windows: [
          { start: local(-1, 10), end: local(-1, 11) },
          { start: local(3, 10), end: local(3, 11) },
        ],
      }),
      input({
        windows: [
          { start: local(2, 11), end: local(2, 10) },
          { start: local(3, 10), end: local(3, 11) },
        ],
      }),
      input({ contactType: "telegram", contact: "+77771234567" }),
      input({ deadline: "2026-02-30" }),
    ];
    const errors = [
      "invalid_time_window",
      "invalid_time_window",
      "invalid_contact",
      "invalid_deadline",
    ];
    for (const [index, data] of bad.entries()) {
      await expect(submitLearnerRequest(data)).rejects.toThrow(errors[index]);
      const stored = await db
        .select()
        .from(participantContacts)
        .where(eq(participantContacts.value, data.contact));
      expect(stored).toHaveLength(0);
    }
  });

  it("reuses one learner participant for repeated requests from the same account", async () => {
    const userId = `d2-test-${randomUUID()}`;
    await db.insert(authUsers).values({
      id: userId,
      name: "D2 Test",
      email: `${userId}@example.test`,
    });

    const first = await submitLearnerRequest(input(), { authUserId: userId });
    const second = await submitLearnerRequest(input(), { authUserId: userId });
    if (first.status !== "eligible" || second.status !== "eligible")
      throw new Error("expected eligible requests");

    const [a, b] = await Promise.all([
      requestRow(first.requestId),
      requestRow(second.requestId),
    ]);
    expect(a.participantId).toBe(b.participantId);
    const links = await db
      .select()
      .from(accountParticipants)
      .where(eq(accountParticipants.authUserId, userId));
    expect(links).toHaveLength(1);
  });

  it("creates one participant when the same account submits twice at the same moment", async () => {
    const userId = `d2-test-${randomUUID()}`;
    await db.insert(authUsers).values({
      id: userId,
      name: "D2 Test",
      email: `${userId}@example.test`,
    });
    const results = await Promise.all([
      submitLearnerRequest(input(), { authUserId: userId }),
      submitLearnerRequest(input(), { authUserId: userId }),
    ]);
    expect(results.every((r) => r.status === "eligible")).toBe(true);
    const links = await db
      .select()
      .from(accountParticipants)
      .where(eq(accountParticipants.authUserId, userId));
    expect(links).toHaveLength(1);
  });

  it("shows the submitted contact for each confirmed request from the same account", async () => {
    const userId = randomUUID();
    await db.insert(authUsers).values({
      id: userId,
      name: "Synthetic learner",
      email: `${userId}@example.test`,
    });
    const firstInput = input();
    const secondInput = input({
      contactType: "phone",
      contact: "+77000000000",
    });
    const first = await submitLearnerRequest(firstInput, {
      authUserId: userId,
    });
    const second = await submitLearnerRequest(secondInput, {
      authUserId: userId,
    });
    if (first.status !== "eligible" || second.status !== "eligible") {
      throw new Error("expected eligible requests");
    }
    const owner = await requestRow(first.requestId);
    const [stored] = await db
      .select()
      .from(participantContacts)
      .where(eq(participantContacts.learnerRequestId, first.requestId));
    expect(stored).toMatchObject({
      participantId: owner.participantId,
      value: firstInput.contact,
    });
    const confirmFirst = await proposeMatch(first.requestId);
    const confirmSecond = await proposeMatch(second.requestId);
    expect((await getLearnerStatusPage(first.token)).contacts).toBeUndefined();
    await confirmFirst();
    await confirmSecond();

    expect((await getLearnerStatusPage(first.token)).contacts).toEqual([
      { type: firstInput.contactType, value: firstInput.contact },
    ]);
    expect((await getLearnerStatusPage(second.token)).contacts).toEqual([
      { type: secondInput.contactType, value: secondInput.contact },
    ]);
  });

  it("shows an unambiguous historical contact and suppresses conflicting options", async () => {
    const legacy = await submitLearnerRequest(input());
    if (legacy.status !== "eligible") throw new Error("expected eligible");
    const request = await requestRow(legacy.requestId);
    const otherLearner = await createParticipant(db, { role: "learner" });
    await db
      .update(participantContacts)
      .set({ learnerRequestId: null })
      .where(eq(participantContacts.learnerRequestId, legacy.requestId));

    await expect(
      db.insert(participantContacts).values({
        participantId: otherLearner.participantId,
        learnerRequestId: legacy.requestId,
        contactType: "telegram",
        value: "@wrong_owner_test",
      }),
    ).rejects.toThrow();

    const confirm = await proposeMatch(legacy.requestId);
    await confirm();
    const value = await db
      .select({
        type: participantContacts.contactType,
        value: participantContacts.value,
      })
      .from(participantContacts)
      .where(eq(participantContacts.participantId, request.participantId));
    expect(value).toHaveLength(1);
    expect((await getLearnerStatusPage(legacy.token)).contacts).toEqual(value);

    await db.insert(participantContacts).values({
      participantId: request.participantId,
      contactType: "telegram",
      value: "@older_contact_test",
    });
    expect((await getLearnerStatusPage(legacy.token)).contacts).toEqual([]);
  });
});
