import { createHash, randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { db, pool } from "@/db/client";
import { rateLimitCounters } from "@/db/schema";
import { allowRateLimitedAttempt, type RateLimitScope } from "./rate-limit";

describe.skipIf(!process.env.DATABASE_URL)(
  "rate limit counters in PostgreSQL",
  () => {
    const keys = new Set<string>();
    const now = new Date("2026-11-04T10:07:00.000Z");

    function hash(scope: RateLimitScope, value: string) {
      const keyHash = createHash("sha256")
        .update(`${scope}:${value}`)
        .digest("hex");
      keys.add(keyHash);
      return keyHash;
    }

    function attempt(
      scope: RateLimitScope,
      value: string,
      maximum: number,
      at = now,
    ) {
      hash(scope, value);
      return allowRateLimitedAttempt(db, scope, value, maximum, at);
    }

    function rows(scope: RateLimitScope, value: string) {
      return db
        .select()
        .from(rateLimitCounters)
        .where(eq(rateLimitCounters.keyHash, hash(scope, value)));
    }

    afterEach(async () => {
      if (keys.size) {
        await db
          .delete(rateLimitCounters)
          .where(inArray(rateLimitCounters.keyHash, [...keys]));
        keys.clear();
      }
    });
    afterAll(async () => {
      await pool.end();
    });

    it("allows exactly the configured attempts and retains the cap on rejection", async () => {
      const value = randomUUID();
      for (let count = 0; count < 3; count++) {
        await expect(attempt("session-action", value, 3)).resolves.toBe(true);
      }
      await expect(attempt("session-action", value, 3)).resolves.toBe(false);
      await expect(attempt("session-action", value, 3)).resolves.toBe(false);
      const stored = await rows("session-action", value);
      expect(stored).toHaveLength(1);
      expect(stored[0].count).toBe(3);
    });

    it("allows only five of 24 concurrent attempts without exceeding the counter", async () => {
      const value = randomUUID();
      const results = await Promise.all(
        Array.from({ length: 24 }, () =>
          attempt("mentor-brief-action", value, 5),
        ),
      );
      expect(results.filter(Boolean)).toHaveLength(5);
      expect(results.filter((allowed) => !allowed)).toHaveLength(19);
      const stored = await rows("mentor-brief-action", value);
      expect(stored).toHaveLength(1);
      expect(stored[0].count).toBe(5);
    });

    it("opens a new UTC window exactly at the existing 15-minute boundary", async () => {
      const value = randomUUID();
      const before = new Date("2026-11-04T10:14:59.999Z");
      const boundary = new Date("2026-11-04T10:15:00.000Z");
      await expect(attempt("rating-action", value, 1, before)).resolves.toBe(
        true,
      );
      await expect(attempt("rating-action", value, 1, before)).resolves.toBe(
        false,
      );
      await expect(attempt("rating-action", value, 1, boundary)).resolves.toBe(
        true,
      );
      const stored = (await rows("rating-action", value)).sort(
        (a, b) => a.windowStartedAt.getTime() - b.windowStartedAt.getTime(),
      );
      expect(stored).toHaveLength(2);
      expect(stored[0].windowStartedAt.toISOString()).toBe(
        "2026-11-04T10:00:00.000Z",
      );
      expect(stored[0].expiresAt).toEqual(boundary);
      expect(stored[1].windowStartedAt).toEqual(boundary);
      expect(stored[1].expiresAt.toISOString()).toBe(
        "2026-11-04T10:30:00.000Z",
      );
    });

    it("isolates different keys and different scopes using the same key", async () => {
      const first = randomUUID();
      const second = randomUUID();
      await expect(attempt("session-action", first, 1)).resolves.toBe(true);
      await expect(attempt("rating-action", first, 1)).resolves.toBe(true);
      await expect(attempt("session-action", second, 1)).resolves.toBe(true);
      await expect(attempt("session-action", first, 1)).resolves.toBe(false);
      expect(keys.size).toBe(3);
      const stored = await db
        .select()
        .from(rateLimitCounters)
        .where(inArray(rateLimitCounters.keyHash, [...keys]));
      expect(stored).toHaveLength(3);
      expect(stored.every((counter) => counter.count === 1)).toBe(true);
    });

    it("stores only the SHA-256 key without the raw identifier", async () => {
      const value = `synthetic-${randomUUID()}@example.test`;
      await attempt("learner-request-account", value, 10);
      const [stored] = await rows("learner-request-account", value);
      expect(stored.keyHash).toMatch(/^[0-9a-f]{64}$/);
      expect(stored.keyHash).toBe(hash("learner-request-account", value));
      expect(JSON.stringify(stored)).not.toContain(value);
      expect(JSON.stringify(stored)).not.toContain("example.test");
    });

    it("does not reset an existing count if the configured maximum is lowered", async () => {
      const value = randomUUID();
      await attempt("report-action", value, 3);
      await attempt("report-action", value, 3);
      await expect(attempt("report-action", value, 1)).resolves.toBe(false);
      const [stored] = await rows("report-action", value);
      expect(stored.count).toBe(2);
    });

    it("stops at the PostgreSQL integer boundary without overflow", async () => {
      const value = randomUUID();
      await db.insert(rateLimitCounters).values({
        keyHash: hash("session-action", value),
        windowStartedAt: new Date("2026-11-04T10:00:00.000Z"),
        expiresAt: new Date("2026-11-04T10:15:00.000Z"),
        count: 2_147_483_646,
      });
      await expect(
        attempt("session-action", value, 2_147_483_647),
      ).resolves.toBe(true);
      await expect(
        attempt("session-action", value, 2_147_483_647),
      ).resolves.toBe(false);
      const [stored] = await rows("session-action", value);
      expect(stored.count).toBe(2_147_483_647);
    });
  },
);
