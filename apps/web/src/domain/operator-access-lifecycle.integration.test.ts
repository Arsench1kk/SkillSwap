import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db/client";
import { events, participants } from "@/db/schema";
import { requireActiveOperator } from "./operator-access";
import { changeOperatorAccess } from "./operator-access-lifecycle";
import { generateParticipantId } from "./participants";

describe.skipIf(!process.env.DATABASE_URL)("operator access lifecycle", () => {
  afterAll(() => pool.end());

  it("grants and revokes access once, records decisions, and retires revoked IDs", async () => {
    const adminId = generateParticipantId("operator");
    await changeOperatorAccess(db, {
      operatorId: adminId,
      decision: "granted",
    });
    const operatorId = generateParticipantId("operator");
    const input = { operatorId, adminId };

    const grants = await Promise.all(
      [1, 2].map(() =>
        changeOperatorAccess(db, { ...input, decision: "granted" }),
      ),
    );
    expect(grants.filter((result) => result.changed)).toHaveLength(1);
    await expect(
      db.transaction((tx) => requireActiveOperator(tx, operatorId)),
    ).resolves.toBe(operatorId);

    const revocation = { ...input, decision: "revoked" as const };
    await expect(changeOperatorAccess(db, revocation)).resolves.toMatchObject({
      changed: true,
    });
    await expect(changeOperatorAccess(db, revocation)).resolves.toMatchObject({
      changed: false,
    });
    await expect(
      db.transaction((tx) => requireActiveOperator(tx, operatorId)),
    ).rejects.toThrow("Active operator required");
    await expect(
      changeOperatorAccess(db, { ...input, decision: "granted" }),
    ).rejects.toThrow("Operator ID retired");
    const audit = await db
      .select({
        eventName: events.eventName,
        actor: events.actor,
        decision: events.reasonCode,
      })
      .from(events)
      .where(eq(events.participantId, operatorId));
    expect(audit).toHaveLength(2);
    expect(audit).toEqual(
      expect.arrayContaining([
        {
          eventName: "operator_access_changed",
          actor: adminId,
          decision: "granted",
        },
        {
          eventName: "operator_access_changed",
          actor: adminId,
          decision: "revoked",
        },
      ]),
    );
    const [bootstrap] = await db
      .select({ actor: events.actor })
      .from(events)
      .where(eq(events.participantId, adminId));
    expect(bootstrap.actor).toBeNull();
  });

  it("refuses to grant a role from a non-owner database connection", async () => {
    const operatorId = generateParticipantId("operator");
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local role pg_read_all_data`);
      await expect(
        changeOperatorAccess(tx, { operatorId, decision: "granted" }),
      ).rejects.toThrow("Database owner required");
    });
    await expect(
      db
        .select()
        .from(participants)
        .where(eq(participants.participantId, operatorId)),
    ).resolves.toEqual([]);
  });
});
