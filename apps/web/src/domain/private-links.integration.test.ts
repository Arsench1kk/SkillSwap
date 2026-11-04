import { createHash, randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { db, pool } from "@/db/client";
import { linkTokens } from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";
import {
  createPrivateLink,
  revokePrivateLink,
  verifyPrivateLink,
} from "./private-links";

describe.skipIf(!process.env.DATABASE_URL)(
  "private link lifecycle in PostgreSQL",
  () => {
    const linkIds: string[] = [];

    async function create(
      database: DatabaseExecutor = db,
      expiresAt = new Date(Date.now() + 86_400_000),
    ) {
      const link = await createPrivateLink(database, {
        purpose: "learner_status",
        subjectType: "learner_request",
        subjectId: randomUUID(),
        expiresAt,
      });
      linkIds.push(link.id);
      return link;
    }

    afterEach(async () => {
      if (linkIds.length) {
        await db.delete(linkTokens).where(inArray(linkTokens.id, linkIds));
        linkIds.length = 0;
      }
    });
    afterAll(async () => {
      await pool.end();
    });

    it("stores a 32-byte SHA-256 hash and returns a distinct 32-byte secret once", async () => {
      const first = await create();
      const second = await create();
      expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(first.token, "base64url")).toHaveLength(32);
      expect(first.token).not.toBe(second.token);
      const [stored] = await db
        .select()
        .from(linkTokens)
        .where(eq(linkTokens.id, first.id));
      expect(stored.tokenHash).toEqual(
        createHash("sha256").update(first.token).digest(),
      );
      expect(stored.tokenHash).toHaveLength(32);
      expect(JSON.stringify(stored)).not.toContain(first.token);
    });

    it("expires at the exact boundary and does not expose subject data after expiry", async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      const link = await create(db, expiresAt);
      await expect(
        verifyPrivateLink(db, link.token, new Date(expiresAt.getTime() - 1)),
      ).resolves.toMatchObject({ status: "valid" });
      await expect(
        verifyPrivateLink(db, link.token, expiresAt),
      ).resolves.toEqual({ status: "expired" });
      await expect(
        verifyPrivateLink(db, link.token, new Date(expiresAt.getTime() + 1)),
      ).resolves.toEqual({ status: "expired" });
    });

    it("rejects a changed or unknown well-formed token without returning metadata", async () => {
      const link = await create();
      const changed = (link.token[0] === "A" ? "B" : "A") + link.token.slice(1);
      await expect(verifyPrivateLink(db, changed)).resolves.toEqual({
        status: "not_found",
      });
      await expect(verifyPrivateLink(db, "_".repeat(43))).resolves.toEqual({
        status: "not_found",
      });
    });

    it("preserves the original revocation time on repeated calls", async () => {
      const link = await create();
      const firstAt = new Date(Date.now() - 1000);
      await expect(revokePrivateLink(db, link.id, firstAt)).resolves.toBe(true);
      await expect(revokePrivateLink(db, link.id, new Date())).resolves.toBe(
        true,
      );
      const [stored] = await db
        .select()
        .from(linkTokens)
        .where(eq(linkTokens.id, link.id));
      expect(stored.revokedAt).toEqual(firstAt);
      await expect(verifyPrivateLink(db, link.token)).resolves.toEqual({
        status: "revoked",
      });
      await expect(revokePrivateLink(db, randomUUID())).resolves.toBe(false);
    });

    it("preserves the first revocation across competing transactions", async () => {
      const link = await create();
      const firstAt = new Date(Date.now() - 1000);
      let competing: Promise<boolean> | undefined;
      await db.transaction(async (tx) => {
        await revokePrivateLink(tx, link.id, firstAt);
        // Another connection updates after this transaction releases the row.
        competing = revokePrivateLink(db, link.id, new Date());
      });
      await expect(competing).resolves.toBe(true);
      const [stored] = await db
        .select()
        .from(linkTokens)
        .where(eq(linkTokens.id, link.id));
      expect(stored.revokedAt).toEqual(firstAt);
    });

    it("rolls back link issuance with a failed caller transaction", async () => {
      let token = "";
      await expect(
        db.transaction(async (tx) => {
          token = (await create(tx)).token;
          throw new Error("synthetic_action_failure");
        }),
      ).rejects.toThrow("synthetic_action_failure");
      await expect(verifyPrivateLink(db, token)).resolves.toEqual({
        status: "not_found",
      });
      expect(
        await db
          .select()
          .from(linkTokens)
          .where(inArray(linkTokens.id, linkIds)),
      ).toHaveLength(0);
    });

    it("rolls back revocation with a failed caller transaction", async () => {
      const link = await create();
      await expect(
        db.transaction(async (tx) => {
          await revokePrivateLink(tx, link.id);
          await expect(verifyPrivateLink(tx, link.token)).resolves.toEqual({
            status: "revoked",
          });
          throw new Error("synthetic_action_failure");
        }),
      ).rejects.toThrow("synthetic_action_failure");
      await expect(verifyPrivateLink(db, link.token)).resolves.toMatchObject({
        status: "valid",
      });
    });

    it("keeps existing purposes and anonymised participant session links compatible", async () => {
      const fixtures = [
        {
          purpose: "learner_status",
          subjectType: "learner_request",
          subjectId: randomUUID(),
        },
        {
          purpose: "mentor_brief",
          subjectType: "mentor_brief",
          subjectId: randomUUID(),
        },
        {
          purpose: "session",
          subjectType: "participant",
          subjectId: "M-012345abcd",
        },
        { purpose: "rating", subjectType: "feedback", subjectId: randomUUID() },
        {
          purpose: "report",
          subjectType: "participant",
          subjectId: "L-012345abcd",
        },
      ] as const;
      for (const input of fixtures) {
        const link = await createPrivateLink(db, {
          ...input,
          expiresAt: new Date(Date.now() + 60_000),
        });
        linkIds.push(link.id);
        await expect(verifyPrivateLink(db, link.token)).resolves.toMatchObject({
          status: "valid",
          ...input,
        });
      }
    });
  },
);
