import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";
import * as schema from "../../src/db/schema";
import { changeOperatorAccess } from "../../src/domain/operator-access-lifecycle";
import { generateParticipantId } from "../../src/domain/participants";

const usage =
  "Usage: manage-access.ts new-id | grant <operator ID> [admin ID] | revoke <operator ID> [admin ID]";

async function main() {
  const [command, operatorId, adminId, ...extra] = process.argv.slice(2);
  if (!process.stdout.isTTY) throw new Error("Run from a private terminal.");
  if (command === "new-id" && !operatorId) {
    console.log(generateParticipantId("operator"));
    return;
  }
  if (
    (command !== "grant" && command !== "revoke") ||
    !operatorId ||
    extra.length
  )
    throw new Error(usage);
  const connectionString = process.env.SKILLSWAP_OPERATOR_ADMIN_DATABASE_URL;
  if (
    !connectionString ||
    !z
      .enum(schema.dataOrigin.enumValues)
      .safeParse(process.env.SKILLSWAP_DATA_ORIGIN).success
  )
    throw new Error(
      "Set SKILLSWAP_OPERATOR_ADMIN_DATABASE_URL and SKILLSWAP_DATA_ORIGIN.",
    );

  const pool = new Pool({ connectionString });
  try {
    const decision = command === "grant" ? "granted" : "revoked";
    const status = await changeOperatorAccess(drizzle(pool, { schema }), {
      decision,
      operatorId,
      adminId,
    });
    console.log(
      status.operatorId,
      status.changed ? decision : `already ${decision}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof z.ZodError
      ? "Check the operator and administrator IDs."
      : error instanceof Error &&
          /^(Usage:|Run from|Set SKILLSWAP_|Database owner required|Active operator required|Operator ID unavailable|Operator ID retired)/.test(
            error.message,
          )
        ? error.message
        : "Could not change operator access.",
  );
  process.exitCode = 1;
});
