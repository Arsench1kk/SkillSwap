import { z } from "zod";
import { db, pool } from "../../src/db/client";
import { dataOrigin } from "../../src/db/schema";
import { withdrawConsentByOperator } from "../../src/services/operator/withdraw-consent";

const usage =
  "Usage: set DATABASE_URL and SKILLSWAP_DATA_ORIGIN, then run withdraw-consent.ts <operator ID> <participant ID>";

async function main() {
  const [operatorId, participantId, ...extra] = process.argv.slice(2);
  if (
    !process.env.DATABASE_URL ||
    !z.enum(dataOrigin.enumValues).safeParse(process.env.SKILLSWAP_DATA_ORIGIN)
      .success ||
    !operatorId ||
    !participantId ||
    extra.length
  )
    throw new Error(usage);
  if (!process.stdout.isTTY) throw new Error("Run from a private terminal.");
  const outcome = await withdrawConsentByOperator(db, {
    operatorId,
    participantId,
  });
  console.log(JSON.stringify(outcome, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof z.ZodError
        ? "Check the operator ID and participant ID."
        : error instanceof Error &&
            /^(Usage:|Run from|Active operator required|Participant unavailable)/.test(
              error.message,
            )
          ? error.message
          : "Could not record consent withdrawal.",
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
