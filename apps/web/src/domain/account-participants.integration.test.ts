import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { db, pool } from "@/db/client";
import { authUsers } from "@/db/auth-schema";
import { accountParticipants, events, participants } from "@/db/schema";
import { recordEvent } from "./events";
import { createParticipant, withdrawParticipantConsent } from "./participants";
import {
  ensureAccountParticipant,
  findAccountParticipant,
} from "./account-participants";

describe.skipIf(!process.env.DATABASE_URL)(
  "account participant identity in PostgreSQL",
  () => {
    const accountIds: string[] = [];
    // A distinct synthetic consent timestamp also lets us detect orphan rows from
    // concurrent losing inserts without counting other suites' participants.
    const consentAt = new Date("2020-01-02T03:04:05.678Z");

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

    async function findTestParticipants() {
      return db
        .select()
        .from(participants)
        .where(eq(participants.consentGivenAt, consentAt));
    }

    afterEach(async () => {
      if (accountIds.length) {
        // FK cascade removes mappings; these fixtures have no committed events.
        await db.delete(authUsers).where(inArray(authUsers.id, accountIds));
        accountIds.length = 0;
      }
      await db
        .delete(participants)
        .where(eq(participants.consentGivenAt, consentAt));
    });

    afterAll(async () => {
      await pool.end();
    });

    it("looks up an unmapped account without creating a participant", async () => {
      const authUserId = await createAccount();
      await expect(
        findAccountParticipant(db, { authUserId, role: "learner" }),
      ).resolves.toBeNull();
      expect(await findTestParticipants()).toHaveLength(0);
    });

    it("keeps separate stable learner and mentor identities for one account", async () => {
      const authUserId = await createAccount();
      const learner = await ensureAccountParticipant(db, {
        authUserId,
        role: "learner",
        consentGivenAt: consentAt,
      });
      const mentor = await ensureAccountParticipant(db, {
        authUserId,
        role: "mentor",
        consentGivenAt: consentAt,
      });
      expect(learner).toMatchObject({
        role: "learner",
        participantId: expect.stringMatching(/^L-[0-9a-f]{10}$/),
      });
      expect(mentor).toMatchObject({
        role: "mentor",
        participantId: expect.stringMatching(/^M-[0-9a-f]{10}$/),
      });
      expect(learner.participantId).not.toBe(mentor.participantId);

      await expect(
        ensureAccountParticipant(db, {
          authUserId,
          role: "learner",
          consentGivenAt: new Date(),
        }),
      ).resolves.toEqual(learner);
      await expect(
        findAccountParticipant(db, { authUserId, role: "mentor" }),
      ).resolves.toEqual(mentor);
      const rows = await findTestParticipants();
      expect(rows).toHaveLength(2);
      expect(
        rows.every(
          (row) => row.consentGivenAt?.getTime() === consentAt.getTime(),
        ),
      ).toBe(true);
      expect(JSON.stringify(rows)).not.toContain("example.test");
      expect(JSON.stringify(rows)).not.toContain(authUserId);
    });

    it("serializes concurrent first requests without duplicate or orphan participants", async () => {
      const authUserId = await createAccount();
      const identities = await Promise.all(
        Array.from({ length: 8 }, () =>
          ensureAccountParticipant(db, {
            authUserId,
            role: "learner",
            consentGivenAt: consentAt,
          }),
        ),
      );
      expect(
        new Set(identities.map((identity) => identity.participantId)).size,
      ).toBe(1);
      expect(await findTestParticipants()).toHaveLength(1);
      const mappings = await db
        .select()
        .from(accountParticipants)
        .where(eq(accountParticipants.authUserId, authUserId));
      expect(mappings).toHaveLength(1);
    });

    it("coexists with the existing unique-index-only creation path", async () => {
      const authUserId = await createAccount();
      const legacyCreation = db.transaction(async (tx) => {
        const provisional = await createParticipant(tx, {
          role: "learner",
          consentGivenAt: consentAt,
        });
        const [created] = await tx
          .insert(accountParticipants)
          .values({
            authUserId,
            role: "learner",
            participantId: provisional.participantId,
          })
          .onConflictDoNothing()
          .returning({ participantId: accountParticipants.participantId });
        if (created) return created.participantId;
        await tx
          .delete(participants)
          .where(eq(participants.participantId, provisional.participantId));
        const [winner] = await tx
          .select()
          .from(accountParticipants)
          .where(
            and(
              eq(accountParticipants.authUserId, authUserId),
              eq(accountParticipants.role, "learner"),
            ),
          );
        return winner.participantId;
      });
      const [legacyId, current] = await Promise.all([
        legacyCreation,
        ensureAccountParticipant(db, {
          authUserId,
          role: "learner",
          consentGivenAt: consentAt,
        }),
      ]);
      expect(current.participantId).toBe(legacyId);
      expect(await findTestParticipants()).toHaveLength(1);
    });

    it("does not return another account's identity or create its missing role on read", async () => {
      const firstUserId = await createAccount();
      const secondUserId = await createAccount();
      const first = await ensureAccountParticipant(db, {
        authUserId: firstUserId,
        role: "learner",
        consentGivenAt: consentAt,
      });
      await expect(
        findAccountParticipant(db, {
          authUserId: secondUserId,
          role: "learner",
        }),
      ).resolves.toBeNull();
      const second = await ensureAccountParticipant(db, {
        authUserId: secondUserId,
        role: "learner",
        consentGivenAt: consentAt,
      });
      expect(first.participantId).not.toBe(second.participantId);
      await expect(
        findAccountParticipant(db, {
          authUserId: secondUserId,
          role: "mentor",
        }),
      ).resolves.toBeNull();
      expect(await findTestParticipants()).toHaveLength(2);
    });

    it("never reactivates or replaces a withdrawn participant on lookup or retry", async () => {
      const authUserId = await createAccount();
      const learner = await ensureAccountParticipant(db, {
        authUserId,
        role: "learner",
        consentGivenAt: consentAt,
      });
      const mentor = await ensureAccountParticipant(db, {
        authUserId,
        role: "mentor",
        consentGivenAt: consentAt,
      });
      await withdrawParticipantConsent(db, learner.participantId);

      await expect(
        findAccountParticipant(db, { authUserId, role: "learner" }),
      ).rejects.toMatchObject({ code: "participant_withdrawn" });
      await expect(
        ensureAccountParticipant(db, {
          authUserId,
          role: "learner",
          consentGivenAt: new Date(),
        }),
      ).rejects.toMatchObject({ code: "participant_withdrawn" });
      await expect(
        findAccountParticipant(db, { authUserId, role: "mentor" }),
      ).resolves.toEqual(mentor);
      expect(await findTestParticipants()).toHaveLength(2);
      const [stored] = await db
        .select()
        .from(participants)
        .where(eq(participants.participantId, learner.participantId));
      expect(stored.status).toBe("withdrawn");
      expect(stored.consentWithdrawnAt).not.toBeNull();
    });

    it("rolls back mapping, participant and event with its caller transaction", async () => {
      const authUserId = await createAccount();
      let rolledBackId = "";
      await expect(
        db.transaction(async (tx) => {
          const identity = await ensureAccountParticipant(tx, {
            authUserId,
            role: "learner",
            consentGivenAt: consentAt,
          });
          rolledBackId = identity.participantId;
          await recordEvent(
            tx,
            { participantId: rolledBackId, dataOrigin: "rehearsal" },
            { eventName: "request_submitted" },
          );
          throw new Error("synthetic_action_failure");
        }),
      ).rejects.toThrow("synthetic_action_failure");

      expect(rolledBackId).toMatch(/^L-/);
      expect(await findTestParticipants()).toHaveLength(0);
      expect(
        await db
          .select()
          .from(events)
          .where(eq(events.participantId, rolledBackId)),
      ).toHaveLength(0);
      await expect(
        findAccountParticipant(db, { authUserId, role: "learner" }),
      ).resolves.toBeNull();
      await expect(
        ensureAccountParticipant(db, {
          authUserId,
          role: "learner",
          consentGivenAt: consentAt,
        }),
      ).resolves.toMatchObject({ role: "learner" });
    });

    it("rejects nonexistent accounts before creating any participant", async () => {
      await expect(
        ensureAccountParticipant(db, {
          authUserId: randomUUID(),
          role: "mentor",
          consentGivenAt: consentAt,
        }),
      ).rejects.toMatchObject({ code: "account_not_found" });
      expect(await findTestParticipants()).toHaveLength(0);
    });

    it("rejects operator roles and missing/invalid consent at runtime", async () => {
      const authUserId = await createAccount();
      for (const invalid of [
        { authUserId, role: "operator", consentGivenAt: consentAt },
        { authUserId, role: "learner", consentGivenAt: null },
        { authUserId, role: "learner", consentGivenAt: new Date("invalid") },
        {
          authUserId,
          role: "learner",
          consentGivenAt: consentAt,
          email: "not-for-participants@example.test",
        },
      ]) {
        // Exercise the JavaScript boundary as well as the public TypeScript type.
        await expect(
          ensureAccountParticipant(
            db,
            invalid as Parameters<typeof ensureAccountParticipant>[1],
          ),
        ).rejects.toMatchObject({ name: "ZodError" });
      }
      expect(await findTestParticipants()).toHaveLength(0);
      expect(
        await db
          .select()
          .from(accountParticipants)
          .where(
            and(
              eq(accountParticipants.authUserId, authUserId),
              eq(accountParticipants.role, "learner"),
            ),
          ),
      ).toHaveLength(0);
    });
  },
);
