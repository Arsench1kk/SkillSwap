import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { participants } from "@/db/schema";
import type { DatabaseTransaction } from "@/db/types";

export const operatorIdSchema = z.string().regex(/^O-[0-9a-f]{10}$/);

/** Only for trusted operator CLI callers already authorized to connect to the database. */
export async function requireActiveOperator(
  tx: DatabaseTransaction,
  operatorId: string,
) {
  const id = operatorIdSchema.parse(operatorId);
  const [operator] = await tx
    .select({ id: participants.participantId })
    .from(participants)
    .where(
      and(
        eq(participants.participantId, id),
        eq(participants.role, "operator"),
        eq(participants.status, "active"),
      ),
    )
    .for("share");
  if (!operator) throw new Error("Active operator required");
  return operator.id;
}
