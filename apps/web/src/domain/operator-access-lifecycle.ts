import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { participants } from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";
import { currentDataOrigin } from "./event-context";
import { operatorAccessDecision, recordEvent } from "./events";
import { operatorIdSchema, requireActiveOperator } from "./operator-access";

const inputSchema = z
  .object({
    operatorId: operatorIdSchema,
    decision: operatorAccessDecision,
    adminId: operatorIdSchema.optional(),
  })
  .strict();

export async function changeOperatorAccess(
  database: DatabaseExecutor,
  input: z.input<typeof inputSchema>,
) {
  const { operatorId, decision, adminId } = inputSchema.parse(input);
  return database.transaction(async (tx) => {
    // The pilot admin CLI authenticates with the owner role of the target DB.
    const owner = await tx.execute<{ authorized: boolean }>(sql`
      select current_user = pg_get_userbyid(datdba) as authorized
      from pg_database where datname = current_database()
    `);
    if (!owner.rows[0]?.authorized) throw new Error("Database owner required");
    const actorParticipantId = adminId
      ? await requireActiveOperator(tx, adminId)
      : undefined;

    const [changed] =
      decision === "granted"
        ? await tx
            .insert(participants)
            .values({ participantId: operatorId, role: "operator" })
            .onConflictDoNothing({ target: participants.participantId })
            .returning({ id: participants.participantId })
        : await tx
            .update(participants)
            .set({ status: "withdrawn" })
            .where(
              and(
                eq(participants.participantId, operatorId),
                eq(participants.role, "operator"),
                eq(participants.status, "active"),
              ),
            )
            .returning({ id: participants.participantId });

    if (!changed) {
      const [existing] = await tx
        .select({ status: participants.status })
        .from(participants)
        .where(
          and(
            eq(participants.participantId, operatorId),
            eq(participants.role, "operator"),
          ),
        );
      if (!existing) throw new Error("Operator ID unavailable");
      if (decision === "granted" && existing.status !== "active") {
        throw new Error("Operator ID retired");
      }
      return { changed: false, operatorId };
    }

    await recordEvent(
      tx,
      {
        participantId: changed.id,
        actorParticipantId,
        dataOrigin: currentDataOrigin(),
      },
      { eventName: "operator_access_changed", reasonCode: decision },
    );
    return { changed: true, operatorId: changed.id };
  });
}
