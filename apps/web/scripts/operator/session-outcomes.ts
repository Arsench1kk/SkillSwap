import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../../src/db/client";
import { dataOrigin, matches, sessions } from "../../src/db/schema";
import { requireActiveOperator } from "../../src/domain/operator-access";
import { recordSessionNoShow } from "../../src/services/sessions/session-outcomes";

const argsSchema = z.union([
  z.tuple([z.string(), z.literal("--list")]),
  z.tuple([z.string(), z.uuid(), z.enum(["learner", "mentor", "both"])]),
]);

async function main() {
  const args = argsSchema.safeParse(process.argv.slice(2));
  if (
    !args.success ||
    !process.env.DATABASE_URL ||
    !z.enum(dataOrigin.enumValues).safeParse(process.env.SKILLSWAP_DATA_ORIGIN)
      .success
  )
    throw new Error(
      "Usage: set DATABASE_URL and SKILLSWAP_DATA_ORIGIN, then run session-outcomes.ts <operator ID> --list or <operator ID> <session UUID> <learner|mentor|both>.",
    );
  if (!process.stdout.isTTY) throw new Error("Run from a private terminal.");

  const [operatorId, target, absent] = args.data;
  if (!absent) {
    const rows = await db.transaction(async (tx) => {
      await requireActiveOperator(tx, operatorId);
      return tx
        .select({
          sessionId: sessions.id,
          requestId: matches.requestId,
          startsAt: sessions.startsAt,
          outcome: sessions.completionState,
        })
        .from(sessions)
        .innerJoin(matches, eq(matches.id, sessions.matchId))
        .where(inArray(sessions.completionState, ["cancelled", "no_show"]))
        .orderBy(desc(sessions.createdAt), desc(sessions.id))
        .limit(50);
    });
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  await recordSessionNoShow(db, { operatorId, sessionId: target, absent });
  console.log("Meeting marked as a no-show.");
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof z.ZodError
        ? "Check the operator ID, meeting ID and absent role."
        : error instanceof Error &&
            /^(Usage:|Run from|Active operator required|Meeting unavailable|Meeting already marked|Wait until)/.test(
              error.message,
            )
          ? error.message
          : "Could not process meeting outcomes.",
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
