import { z } from "zod";
import { db, pool } from "../../src/db/client";
import { dataOrigin } from "../../src/db/schema";
import { formatKazakhstanTime } from "../../src/domain/time";
import { issueFirstBrief } from "../../src/services/mentor/issue-first-brief";
import {
  listUnassignedRequests,
  listVerifiedSkills,
} from "../../src/services/operator/matching-queue";
import { baseUrlSchema } from "./private-link-base";

const usage =
  "Usage: match-request.ts queue <operator ID> | skills <operator ID> <request UUID> | invite <operator ID> <request UUID> <skill UUID> <reason>";

async function main() {
  const [command, operatorId, ...args] = process.argv.slice(2);
  if (!process.env.DATABASE_URL || !operatorId) throw new Error(usage);
  if (!process.stdout.isTTY) throw new Error("Run from a private terminal.");
  if (command === "queue" && args.length === 0) {
    const rows = await listUnassignedRequests(db, operatorId);
    console.log(
      JSON.stringify(
        rows.map(({ deadlineAt, ...row }) => ({
          ...row,
          deadline: formatKazakhstanTime(deadlineAt, "en"),
        })),
        null,
        2,
      ),
    );
    return;
  }
  if (command === "skills" && args.length === 1) {
    console.log(
      JSON.stringify(
        await listVerifiedSkills(db, operatorId, args[0]),
        null,
        2,
      ),
    );
    return;
  }
  if (command !== "invite" || args.length !== 3) throw new Error(usage);
  const base = baseUrlSchema.safeParse(process.env.NEXT_PUBLIC_APP_URL);
  if (
    !base.success ||
    !z.enum(dataOrigin.enumValues).safeParse(process.env.SKILLSWAP_DATA_ORIGIN)
      .success
  ) {
    throw new Error(
      "Set NEXT_PUBLIC_APP_URL and SKILLSWAP_DATA_ORIGIN for this environment.",
    );
  }
  const [requestId, skillId, reason] = args;
  const { link, answerBy } = await issueFirstBrief(db, {
    operatorId,
    requestId,
    skillId,
    reason,
  });
  console.log(
    "Mentor invitation:",
    new URL(`/brief/${link.token}`, base.data).href,
  );
  console.log("Answer by:", formatKazakhstanTime(answerBy, "en"));
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof z.ZodError
        ? "Check the IDs and enter a short reason without contacts."
        : error instanceof Error &&
            /^(Usage:|Run from|Set NEXT_PUBLIC_APP_URL|Active operator required|Request unavailable|Request already has|Verified mentor skill unavailable)/.test(
              error.message,
            )
          ? error.message
          : "Could not complete the operator command.",
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
