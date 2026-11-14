import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db/client";
import {
  accountParticipants,
  authUsers,
  events,
  learnerRequests,
  participantContacts,
} from "@/db/schema";
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

  // A06 is blocked on decision R08 (is the contact the account's current value
  // or a snapshot per request?) and on a D1 schema change. Not implemented here.
  it.todo(
    "A06: after two requests with different contacts, each request shows the contact it was submitted with (blocked: R08 + D1 model)",
  );
});
