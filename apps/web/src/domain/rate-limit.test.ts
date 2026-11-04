import { describe, expect, it, vi } from "vitest";
import type { ApplicationDatabase } from "@/db/types";
import { allowRateLimitedAttempt } from "./rate-limit";

function unusedDatabase() {
  const insert = vi.fn();
  return { database: { insert } as unknown as ApplicationDatabase, insert };
}

describe("rate limit server configuration", () => {
  it.each([0, -1, 1.5, NaN, Infinity, 2_147_483_648])(
    "rejects invalid maximum %s before allowing a first attempt",
    async (maximum) => {
      const { database, insert } = unusedDatabase();
      await expect(
        allowRateLimitedAttempt(
          database,
          "session-action",
          "synthetic-key",
          maximum,
        ),
      ).rejects.toThrow();
      expect(insert).not.toHaveBeenCalled();
    },
  );

  it.each(["", "   ", null, undefined, 42])(
    "rejects invalid key %s without creating a shared counter",
    async (key) => {
      const { database, insert } = unusedDatabase();
      await expect(
        allowRateLimitedAttempt(database, "session-action", key as never, 10),
      ).rejects.toThrow();
      expect(insert).not.toHaveBeenCalled();
    },
  );

  it.each(["", "new-scope", undefined, "session-action:fake"])(
    "rejects unsupported scope %s",
    async (scope) => {
      const { database, insert } = unusedDatabase();
      await expect(
        allowRateLimitedAttempt(database, scope as never, "synthetic-key", 10),
      ).rejects.toThrow();
      expect(insert).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid clock before constructing the time window", async () => {
    const { database, insert } = unusedDatabase();
    await expect(
      allowRateLimitedAttempt(
        database,
        "session-action",
        "synthetic-key",
        10,
        new Date("invalid"),
      ),
    ).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });

  it("propagates a database failure instead of silently allowing an action", async () => {
    const { database, insert } = unusedDatabase();
    insert.mockImplementation(() => {
      throw new Error("synthetic_database_failure");
    });
    await expect(
      allowRateLimitedAttempt(database, "session-action", "synthetic-key", 10),
    ).rejects.toThrow("synthetic_database_failure");
  });
});
