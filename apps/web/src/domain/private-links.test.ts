import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { DatabaseExecutor } from "@/db/types";
import {
  createPrivateLink,
  revokePrivateLink,
  verifyPrivateLink,
} from "./private-links";

function unusedDatabase() {
  const insert = vi.fn();
  const select = vi.fn();
  const update = vi.fn();
  return {
    database: { insert, select, update } as unknown as DatabaseExecutor,
    insert,
    select,
    update,
  };
}

describe("private link input boundaries", () => {
  it.each([
    undefined,
    null,
    42,
    [],
    {},
    "",
    "short",
    "x".repeat(44),
    "x".repeat(42) + "!",
    " " + "x".repeat(43),
  ])(
    "rejects malformed tokens without querying PostgreSQL (%s)",
    async (token) => {
      const { database, select } = unusedDatabase();
      await expect(
        verifyPrivateLink(database, token as never),
      ).resolves.toEqual({ status: "not_found" });
      expect(select).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid verification clock before it can bypass expiry", async () => {
    const { database, select } = unusedDatabase();
    await expect(
      verifyPrivateLink(database, "x".repeat(43), new Date("invalid")),
    ).rejects.toThrow();
    expect(select).not.toHaveBeenCalled();
  });

  it("rejects past and invalid expiry before allocating a token row", async () => {
    const { database, insert } = unusedDatabase();
    const valid = {
      purpose: "learner_status" as const,
      subjectType: "learner_request" as const,
      subjectId: randomUUID(),
    };
    for (const expiresAt of [new Date(0), new Date("invalid")]) {
      await expect(
        createPrivateLink(database, { ...valid, expiresAt }),
      ).rejects.toThrow();
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects PII/incorrect subject IDs and unsupported token types", async () => {
    const { database, insert } = unusedDatabase();
    const valid = {
      purpose: "learner_status",
      subjectType: "learner_request",
      subjectId: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    };
    const invalid = [
      { ...valid, subjectId: "synthetic@example.test" },
      { ...valid, subjectId: "account-id" },
      { ...valid, subjectType: "participant", subjectId: randomUUID() },
      { ...valid, subjectType: "participant", subjectId: "L-short" },
      { ...valid, purpose: "password_reset" },
      { ...valid, subjectType: "account" },
      { ...valid, email: "synthetic@example.test" },
    ];
    for (const input of invalid) {
      await expect(
        createPrivateLink(database, input as never),
      ).rejects.toThrow();
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("validates the revocation ID and timestamp before any update", async () => {
    const { database, update } = unusedDatabase();
    await expect(revokePrivateLink(database, "not-a-uuid")).rejects.toThrow();
    await expect(
      revokePrivateLink(database, randomUUID(), new Date("invalid")),
    ).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
