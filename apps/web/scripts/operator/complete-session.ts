import { z } from "zod";
import { db, pool } from "../../src/db/client";
import { dataOrigin } from "../../src/db/schema";
import {
  formatKazakhstanTime,
  kazakhstanLocalTimeToUtc,
} from "../../src/domain/time";
import { completeSession } from "../../src/services/sessions/complete-session";
import { baseUrlSchema } from "./private-link-base";

const noLink = {
  window_closed: "The two-hour rating window has closed.",
  learner_inactive: "The learner is inactive.",
  already_submitted: "The learner has already finished the rating.",
};

async function main() {
  const [sessionId, operatorId, start, end, ...extra] = process.argv.slice(2);
  const base = baseUrlSchema.safeParse(process.env.NEXT_PUBLIC_APP_URL);
  if (
    !process.env.DATABASE_URL ||
    !base.success ||
    !sessionId ||
    !operatorId ||
    !start ||
    !end ||
    extra.length
  ) {
    throw new Error(
      "Usage: set DATABASE_URL and NEXT_PUBLIC_APP_URL, then run npx tsx scripts/operator/complete-session.ts <session UUID> <operator ID> <actual start> <actual end>. Enter both times as YYYY-MM-DDTHH:mm in Almaty time.",
    );
  }
  if (
    !z.enum(dataOrigin.enumValues).safeParse(process.env.SKILLSWAP_DATA_ORIGIN)
      .success
  ) {
    throw new Error("Set SKILLSWAP_DATA_ORIGIN for this environment.");
  }
  if (!process.stdout.isTTY) {
    throw new Error("Run from a private terminal to copy the link directly.");
  }
  const actualStart = kazakhstanLocalTimeToUtc(start);
  const actualEnd = kazakhstanLocalTimeToUtc(end);
  if (!actualStart || !actualEnd)
    throw new Error("Invalid Almaty time. Use YYYY-MM-DDTHH:mm.");
  const result = await completeSession(db, {
    sessionId,
    operatorId,
    actualStart,
    actualEnd,
  });
  console.log("Meeting completion recorded.");
  if (!result.ratingLink) {
    console.log(noLink[result.reason]);
    return;
  }
  console.log(
    "Learner rating:",
    new URL(`/rate/${result.ratingLink.token}`, base.data).href,
  );
  console.log("Submit by:", formatKazakhstanTime(result.closesAt, "en"));
  console.log("View until:", formatKazakhstanTime(result.expiresAt, "en"));
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof z.ZodError
        ? "Check the meeting ID, operator ID, and actual times."
        : error instanceof Error &&
            /^(Usage:|Set SKILLSWAP_DATA_ORIGIN|Run from|Invalid Almaty time|Active operator required|Meeting unavailable|Meeting already completed)/.test(
              error.message,
            )
          ? error.message
          : "Could not record the meeting completion.",
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
