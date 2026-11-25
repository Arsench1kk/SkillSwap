import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../app/api/account/requests/route";
import { db, pool } from "@/db/client";
import {
  authUsers,
  events,
  learnerRequests,
  participantContacts,
} from "@/db/schema";
import { findAccountParticipant } from "./account-participants";
import { withdrawParticipantConsent } from "./participants";
import { toKazakhstanDateInput } from "./time";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const DAY = 86_400_000;

async function createAccount() {
  const userId = randomUUID();
  await db.insert(authUsers).values({
    id: userId,
    name: "Synthetic learner",
    email: `${userId}@example.test`,
  });
  return userId;
}

function learnerSession(userId: string) {
  getSession.mockResolvedValue({ user: { id: userId, activeRole: "learner" } });
}

function sendRequest(task: string) {
  const now = Date.now();
  const localDate = (days: number) =>
    toKazakhstanDateInput(new Date(now + days * DAY));

  return POST(
    new Request("http://localhost/api/account/requests", {
      method: "POST",
      body: JSON.stringify({
        category: "STEM",
        task,
        tried: "I refreshed the chart after updating the source data.",
        deadline: localDate(7),
        windows: [2, 3].map((day) => ({
          start: `${localDate(day)}T10:00`,
          end: `${localDate(day)}T11:00`,
        })),
        contactType: "telegram",
        contact: "@synthetic_learner",
        giveBack: "",
        consent: true,
      }),
    }),
  );
}

describe.skipIf(!process.env.DATABASE_URL)(
  "account learner request access",
  () => {
    afterAll(() => pool.end());

    it("lists only the account's requests and rejects reads and writes after consent is withdrawn", async () => {
      const learner = await createAccount();
      const otherLearner = await createAccount();

      learnerSession(otherLearner);
      expect(
        (await sendRequest("Help me fix a formula in my notes.")).status,
      ).toBe(201);
      learnerSession(learner);
      await expect((await GET()).json()).resolves.toEqual({ requests: [] });

      const task = "Review a chart that no longer reflects source data.";
      const created = await sendRequest(task);
      expect(created.status).toBe(201);
      const { requestId } = await created.json();

      const visible = await GET();
      expect(visible.status).toBe(200);
      expect(visible.headers.get("cache-control")).toBe("private, no-store");
      const { requests } = await visible.json();
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        id: requestId,
        taskDescription: task,
      });

      const participant = await findAccountParticipant(db, {
        authUserId: learner,
        role: "learner",
      });
      if (!participant) throw new Error("Learner participant was not created.");
      await withdrawParticipantConsent(db, participant.participantId);
      const deniedRead = await GET();
      const deniedWrite = await sendRequest(
        "Help me sort a second spreadsheet.",
      );
      for (const denied of [deniedRead, deniedWrite]) {
        expect(denied.status).toBe(403);
        await expect(denied.json()).resolves.toEqual({
          error: "participant_withdrawn",
        });
      }

      const predicate = participant.participantId;
      const [storedRequests, storedEvents, contacts] = await Promise.all([
        db
          .select()
          .from(learnerRequests)
          .where(eq(learnerRequests.participantId, predicate)),
        db.select().from(events).where(eq(events.participantId, predicate)),
        db
          .select()
          .from(participantContacts)
          .where(eq(participantContacts.participantId, predicate)),
      ]);
      expect(storedRequests).toHaveLength(1);
      expect(storedEvents).toHaveLength(2);
      expect(contacts).toHaveLength(1);
    });
  },
);
