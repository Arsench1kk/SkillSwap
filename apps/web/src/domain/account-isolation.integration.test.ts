import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/account/requests/route";
import { db, pool } from "@/db/client";
import { authUsers } from "@/db/auth-schema";
import { learnerRequests, participants } from "@/db/schema";
import {
  ensureAccountParticipant,
  type AccountRole,
} from "./account-participants";

// TC-01: a new account never sees another account's requests. The list is read
// through the real GET /api/account/requests handler with a stubbed session.

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const DAY = 86_400_000;
const ROUNDS = 3;
const ROLES: readonly AccountRole[] = ["learner", "mentor"];

describe.skipIf(!process.env.DATABASE_URL)(
  "account isolation of learner requests",
  () => {
    const accountIds: string[] = [];
    // A distinct synthetic consent timestamp marks this suite's participants.
    const consentAt = new Date("2020-03-04T05:06:07.890Z");

    async function createAccount() {
      const id = randomUUID();
      await db.insert(authUsers).values({
        id,
        name: "SYNTHETIC ACCOUNT",
        email: `${id}@example.test`,
      });
      accountIds.push(id);
      return id;
    }

    async function createRequestFor(authUserId: string) {
      const learner = await ensureAccountParticipant(db, {
        authUserId,
        role: "learner",
        consentGivenAt: consentAt,
      });
      const now = Date.now();
      const [row] = await db
        .insert(learnerRequests)
        .values({
          participantId: learner.participantId,
          taskCategory: "STEM",
          taskDescription: "Synthetic task: a chart that does not update.",
          triedAlready: "Synthetic: refreshed the source data.",
          deadlineAt: new Date(now + 7 * DAY),
          preferredWindows: [
            {
              startUtc: new Date(now + 2 * DAY).toISOString(),
              endUtc: new Date(now + 2 * DAY + 3_600_000).toISOString(),
            },
          ],
          status: "eligible",
        })
        .returning({ id: learnerRequests.id });
      return row.id;
    }

    function signIn(userId: string, activeRole: AccountRole) {
      getSession.mockResolvedValue({ user: { id: userId, activeRole } });
    }

    afterEach(async () => {
      const testParticipants = db
        .select({ id: participants.participantId })
        .from(participants)
        .where(eq(participants.consentGivenAt, consentAt));
      await db
        .delete(learnerRequests)
        .where(inArray(learnerRequests.participantId, testParticipants));
      if (accountIds.length) {
        // FK cascade removes the account to participant mappings.
        await db.delete(authUsers).where(inArray(authUsers.id, accountIds));
        accountIds.length = 0;
      }
      await db
        .delete(participants)
        .where(eq(participants.consentGivenAt, consentAt));
      getSession.mockReset();
    });

    afterAll(() => pool.end());

    for (let round = 1; round <= ROUNDS; round += 1) {
      for (const role of ROLES) {
        it(`round ${round}: a new account in the ${role} role sees none of another account's requests`, async () => {
          const accountA = await createAccount();
          const accountB = await createAccount();
          const requestId = await createRequestFor(accountA);
          // B also gets an identity in the role under test.
          await ensureAccountParticipant(db, {
            authUserId: accountB,
            role,
            consentGivenAt: consentAt,
          });

          signIn(accountB, role);
          const asB = await GET();
          const bodyB = await asB.json();
          if (role === "learner") {
            expect(asB.status).toBe(200);
            expect(bodyB).toEqual({ requests: [] });
          } else {
            // The list is learner only; a mentor session is refused outright.
            expect(asB.status).toBe(403);
            expect(bodyB).toEqual({ error: "learner_role_required" });
          }
          expect(JSON.stringify(bodyB)).not.toContain(requestId);

          signIn(accountA, "learner");
          const asA = await GET();
          expect(asA.status).toBe(200);
          const { requests } = await asA.json();
          expect(requests).toHaveLength(1);
          expect(requests[0]).toMatchObject({ id: requestId });
        });
      }
    }
  },
);
